import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { AppointmentQueryService } from './appointment-query.service';
import { AppointmentAnalyticsService } from './appointment-analytics.service';
import { AppointmentSlotService } from './appointment-slot.service';
import { AppointmentBookingService } from './appointment-booking.service';
import { AppointmentPublicService } from './appointment-public.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';
import { NotificationModule } from '../notification/notification.module';
import { BranchModule } from '../branch/branch.module';
import { AppointmentFeatureGuard } from './appointment-feature.guard';

@Module({
  imports: [NotificationModule, BranchModule],
  controllers: [AppointmentController],
  providers: [
    AppointmentQueryService,
    AppointmentAnalyticsService,
    AppointmentSlotService,
    AppointmentBookingService,
    AppointmentPublicService,
    AppointmentReminderService,
    AppointmentLifecycleService,
    AppointmentService,
    AppointmentFeatureGuard,
  ],
  exports: [AppointmentService],
})
export class AppointmentModule {}
