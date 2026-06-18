import {
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getObservabilityRelease } from '@queueplatform/shared';
import { Public } from '../decorators/public.decorator';
import { isSentryEnabled } from '../observability/sentry';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness for load balancers — does not touch DB/Redis (avoids false negatives during brief dependency blips). */
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Build/release metadata for ops dashboards and deploy verification. */
  @Public()
  @Get('meta')
  meta() {
    return {
      status: 'ok',
      release: getObservabilityRelease(),
      environment: process.env.NODE_ENV || 'development',
      sentryEnabled: isSentryEnabled(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Throws a test error for Sentry wiring checks.
   * In production, requires header `x-sentry-test-secret` matching `SENTRY_TEST_SECRET`.
   */
  @Public()
  @Get('sentry-test')
  sentryTest(@Headers('x-sentry-test-secret') secret?: string) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const expected = process.env.SENTRY_TEST_SECRET?.trim();
      if (!expected || secret !== expected) {
        throw new NotFoundException();
      }
    }
    throw new Error('Sentry health test exception (intentional)');
  }

  @Public()
  @Get()
  async check() {
    const timestamp = new Date().toISOString();
    const [database, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.getClient().ping(),
    ]);

    const response = {
      status: database.status === 'fulfilled' && redis.status === 'fulfilled' ? 'ok' : 'degraded',
      timestamp,
      uptime: process.uptime(),
      dependencies: {
        database: database.status === 'fulfilled' ? 'ok' : 'error',
        redis: redis.status === 'fulfilled' ? 'ok' : 'error',
      },
    };

    if (response.status !== 'ok') {
      this.logger.error(
        JSON.stringify({
          message: 'Health check degraded',
          response,
        }),
      );
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
