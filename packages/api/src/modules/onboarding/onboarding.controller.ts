import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  OnboardingCompanyProfileDto,
  OnboardingLocationDto,
  OnboardingModulesDto,
} from './dto/onboarding.dto';

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Get current onboarding progress' })
  @RequirePermissions({ resource: 'organization', action: 'read' })
  async getProgress(@CurrentUser('orgId') orgId: string) {
    const data = await this.onboardingService.getProgress(orgId);
    return { success: true, data };
  }

  @Patch('service-selection')
  @ApiOperation({ summary: 'Select initial service modules' })
  @RequirePermissions({ resource: 'organization', action: 'update' })
  async serviceSelection(@CurrentUser('orgId') orgId: string, @Body() body: OnboardingModulesDto) {
    const data = await this.onboardingService.updateServiceSelection(orgId, body.modules);
    return { success: true, data };
  }

  @Patch('company-profile')
  @ApiOperation({ summary: 'Set company profile details' })
  @RequirePermissions({ resource: 'organization', action: 'update' })
  async companyProfile(
    @CurrentUser('orgId') orgId: string,
    @Body() body: OnboardingCompanyProfileDto,
  ) {
    const data = await this.onboardingService.updateCompanyProfile(orgId, body);
    return { success: true, data };
  }

  @Patch('location')
  @ApiOperation({ summary: 'Set business location on map' })
  @RequirePermissions({ resource: 'organization', action: 'update' })
  async location(@CurrentUser('orgId') orgId: string, @Body() body: OnboardingLocationDto) {
    const data = await this.onboardingService.updateLocation(orgId, body);
    return { success: true, data };
  }

  @Patch('complete')
  @ApiOperation({ summary: 'Mark onboarding as completed' })
  @RequirePermissions({ resource: 'organization', action: 'update' })
  async complete(@CurrentUser('orgId') orgId: string) {
    const data = await this.onboardingService.complete(orgId);
    return { success: true, data };
  }
}
