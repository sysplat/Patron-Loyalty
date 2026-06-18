import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CommonModule } from '../../common/common.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PlatformOperatorGuard } from './platform-operator.guard';
import { SupportNotificationListener } from './support-notification.listener';

@Module({
  imports: [NotificationModule, CommonModule],
  controllers: [SupportController],
  providers: [SupportService, PlatformOperatorGuard, SupportNotificationListener],
  exports: [SupportService, PlatformOperatorGuard],
})
export class SupportModule {}
