import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';

/**
 * Read-only deployment signals for platform operators (no secrets).
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/deployment', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformDeploymentController {
  constructor(private readonly config: ConfigService) {}

  @Get('features')
  @ApiOperation({ summary: 'Feature gates from environment (visit journeys, etc.)' })
  getFeatures() {
    return {
      success: true,
      data: {
        visitJourneysGloballyDisabled: this.config.get<boolean>(
          'app.visitJourneysGloballyDisabled',
          false,
        ),
        visitJourneysLegacyGlobalOn: this.config.get<boolean>(
          'app.visitJourneysLegacyGlobalOn',
          false,
        ),
      },
    };
  }
}
