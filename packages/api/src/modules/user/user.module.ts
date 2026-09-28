import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [NotificationModule, BillingModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
