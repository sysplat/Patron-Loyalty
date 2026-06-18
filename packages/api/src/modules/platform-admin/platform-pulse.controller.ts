import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { PlatformPulseService } from './platform-pulse.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/pulse', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformPulseController {
  constructor(private readonly pulse: PlatformPulseService) {}

  @Get()
  @ApiOperation({ summary: 'Platform Pulse — aggregate queue metrics across all organizations' })
  async getPulse() {
    const data = await this.pulse.getPulse();
    return { success: true, data };
  }
}
