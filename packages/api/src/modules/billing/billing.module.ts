import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanLimitService } from './plan-limit.service';
import { SmsCreditPurchaseService } from './sms-credit-purchase.service';
import { SmsUsageService } from './sms-usage.service';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [BillingController],
  providers: [BillingService, PlanLimitService, SmsCreditPurchaseService, SmsUsageService],
  exports: [BillingService, PlanLimitService, SmsCreditPurchaseService, SmsUsageService],
})
export class BillingModule {}
