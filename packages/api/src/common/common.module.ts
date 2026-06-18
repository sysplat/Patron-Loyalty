import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditService } from './audit/audit.service';
import { PlatformAuditService } from './audit/platform-audit.service';
import { PatronCrmFeatureService } from './features/patron-crm-feature.service';
import { ProductEntitlementService } from './features/product-entitlement.service';
import { RequestContextService } from './request-context/request-context.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { SentryContextInterceptor } from './interceptors/sentry-context.interceptor';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    RequestContextService,
    AuditService,
    PlatformAuditService,
    PatronCrmFeatureService,
    ProductEntitlementService,
    LoggingInterceptor,
    SentryContextInterceptor,
  ],
  exports: [
    RequestContextService,
    AuditService,
    PlatformAuditService,
    PatronCrmFeatureService,
    ProductEntitlementService,
    LoggingInterceptor,
    SentryContextInterceptor,
  ],
})
export class CommonModule {}
