import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { isLoyaltyOnlyApiDeploy, resolveApiDeployProfile } from '@queueplatform/shared';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SentryContextInterceptor } from './common/interceptors/sentry-context.interceptor';
import { RequestContextService } from './common/request-context/request-context.service';
import { captureUnhandledProcessError, initSentry } from './common/observability/sentry';

const bootstrapLogger = new Logger('Bootstrap');

initSentry();
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  bootstrapLogger.log('Sentry initialized');
}

function parseAllowedOrigins(isDev: boolean): string[] {
  if (isDev) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ];
  }

  const primary = (process.env.APP_URL || '').trim();
  const extras = (process.env.APP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = [primary, ...extras].filter(Boolean);

  return origins;
}

/**
 * Boot-time environment validation.
 * Runs before the NestJS app is instantiated so misconfigurations fail fast.
 */
function validateEnv(): void {
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.NODE_ENV === 'production') {
    const insecureDefaults = [
      ['JWT_SECRET', 'change-me'],
      ['JWT_REFRESH_SECRET', 'change-me-refresh'],
    ] as const;
    for (const [key, defaultVal] of insecureDefaults) {
      if (process.env[key] === defaultVal) {
        throw new Error(
          `${key} must be changed from its default value before running in production`,
        );
      }
    }
    if (
      !process.env.CENTRIFUGO_WEBHOOK_SECRET?.trim() &&
      !isLoyaltyOnlyApiDeploy(resolveApiDeployProfile())
    ) {
      throw new Error('CENTRIFUGO_WEBHOOK_SECRET is required in production');
    }
    if (!process.env.TWILIO_AUTH_TOKEN?.trim()) {
      throw new Error('TWILIO_AUTH_TOKEN is required in production for webhook verification');
    }
    if (!process.env.ENCRYPTION_KEY?.trim()) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    const hasCorsPrimary = Boolean(process.env.APP_URL?.trim());
    const hasCorsExtras = Boolean(
      process.env.APP_ALLOWED_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean).length,
    );
    if (!hasCorsPrimary && !hasCorsExtras) {
      throw new Error(
        'APP_URL or APP_ALLOWED_ORIGINS must be configured in production for CORS allowlist',
      );
    }
    if (!process.env.APP_DATABASE_URL?.trim()) {
      throw new Error('APP_DATABASE_URL is required in production');
    }
    if (process.env.EXPOSE_INVITE_TOKENS === 'true') {
      throw new Error('EXPOSE_INVITE_TOKENS cannot be enabled in production');
    }
    if (process.env.FEATURE_VISIT_JOURNEYS === 'false') {
      bootstrapLogger.warn(
        'FEATURE_VISIT_JOURNEYS=false — multi-step visit journeys are disabled for every organization on this deployment',
      );
    }
  }
}

async function bootstrap() {
  try {
    const deployProfile = resolveApiDeployProfile();
    bootstrapLogger.log(
      `Starting API bootstrap (NODE_ENV=${process.env.NODE_ENV ?? 'development'}, PORT=${process.env.PORT || '4000'}, API_DEPLOY_PROFILE=${deployProfile})`,
    );

    validateEnv();

    const jsonBodyLimit = process.env.API_JSON_BODY_LIMIT?.trim() || '5mb';

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      rawBody: true,
    });
    app.useBodyParser('json', { limit: jsonBodyLimit });
    app.useBodyParser('urlencoded', { limit: jsonBodyLimit, extended: true });

    const trustProxyEnabled =
      process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true';
    if (trustProxyEnabled) {
      app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }

    const requestContext = app.get(RequestContextService);

    app.use((req: Request, res: Response, next: NextFunction) => {
      const headerRequestId = req.headers['x-request-id'];
      const requestId =
        typeof headerRequestId === 'string' && headerRequestId.length > 0
          ? headerRequestId
          : randomUUID();

      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);

      requestContext.run(
        {
          requestId,
          ip: req.ip,
          userAgent: req.get('user-agent') || undefined,
        },
        () => next(),
      );
    });

    bootstrapLogger.log('AppModule created');

    // Security
    app.use(helmet());

    const isDev = process.env.NODE_ENV !== 'production';
    const allowedOrigins = parseAllowedOrigins(isDev);
    if (!isDev && allowedOrigins.length === 0) {
      throw new Error('No allowed CORS origins resolved in production');
    }
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });

    // API Versioning
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
      prefix: 'api/v',
    });

    // Global Exception Filter
    app.useGlobalFilters(new GlobalExceptionFilter(requestContext));
    app.useGlobalInterceptors(app.get(SentryContextInterceptor), app.get(LoggingInterceptor));

    // Global Validation Pipe (nestjs-zod)
    app.useGlobalPipes(new ZodValidationPipe());

    // Swagger / OpenAPI (dev only)
    if (!isDev) {
      // skip Swagger in production
    } else {
      const deployProfile = resolveApiDeployProfile();
      const isLoyalty = isLoyaltyOnlyApiDeploy(deployProfile);
      const swaggerConfig = new DocumentBuilder()
        .setTitle(isLoyalty ? 'Patron Loyalty API' : 'QlessQ API')
        .setDescription(
          isLoyalty
            ? 'Patron Loyalty (LMS) — CRM, points, tiers, campaigns, integrations'
            : 'Multi-tenant SaaS API for queue management, appointments, and services',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication & registration')
        .addTag('onboarding', 'Onboarding wizard')
        .addTag('branches', 'Branch management')
        .addTag('services', 'Service catalog')
        .addTag('queues', 'Queue management')
        .addTag('tickets', 'Ticket operations')
        .addTag('users', 'User management')
        .addTag('roles', 'Roles & permissions')
        .addTag('reports', 'Reports & analytics')
        .addTag('display', 'Display device management')
        .addTag('notifications', 'Notification templates & logs')
        .addTag('billing', 'Billing & subscriptions')
        .addTag('settings', 'Organization settings')
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
    }

    const port = process.env.PORT || 4000;
    await app.listen(port, '0.0.0.0');
    bootstrapLogger.log(`API listening on 0.0.0.0:${port}`);
  } catch (error) {
    const message =
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    console.error('FATAL ERROR', error);
    captureUnhandledProcessError(error, 'bootstrap');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  bootstrapLogger.error(
    `Unhandled rejection: ${reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason)}`,
  );
  captureUnhandledProcessError(reason, 'unhandledRejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  bootstrapLogger.error(`Uncaught exception: ${err.message}\n${err.stack ?? ''}`);
  captureUnhandledProcessError(err, 'uncaughtException');
  process.exit(1);
});

bootstrap();
