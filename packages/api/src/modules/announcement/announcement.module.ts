import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementService } from './announcement.service';
import { DisplayModule } from '../display/display.module';

@Module({
  imports: [DisplayModule, RealtimeModule],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
