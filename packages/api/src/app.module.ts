import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { resolveApiDeployProfile } from '@queueplatform/shared';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { appConfig } from './config/app.config';
import { JwtAuthGuard } from './common/guards/auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { QueueProductGuard } from './common/guards/queue-product.guard';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health/health.controller';
import { StartupSeederService } from './common/startup/startup-seeder.service';
import { resolveFeatureModulesForProfile } from './app-modules.registry';

const resolveThrottleLimit = (envKey: string, fallback: number): number => {
  const raw = Number.parseInt(process.env[envKey] || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
};

const deployProfile = resolveApiDeployProfile();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: [
        '.env.local',
        '.env',
        '../../.env',
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
      ],
    }),

    CommonModule,
    EventEmitterModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: resolveThrottleLimit('THROTTLE_SHORT_LIMIT', 20),
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: resolveThrottleLimit('THROTTLE_MEDIUM_LIMIT', 100),
      },
    ]),

    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
          },
    }),

    PrismaModule,
    RedisModule,

    ...resolveFeatureModulesForProfile(deployProfile),
  ],
  controllers: [HealthController],
  providers: [
    StartupSeederService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: QueueProductGuard },
  ],
})
export class AppModule {}
