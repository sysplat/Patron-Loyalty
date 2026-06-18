import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { guidedSetupDeploySchema, type GuidedSetupDeployInput } from '@queueplatform/shared';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OrgOwnerOrAdminGuard } from '../../common/guards/org-owner-or-admin.guard';
import { GuidedSetupService } from './guided-setup.service';

@ApiTags('Step-by-step builder')
@ApiBearerAuth()
@Controller({ path: 'guided-setup', version: '1' })
export class GuidedSetupController {
  constructor(private readonly guidedSetupService: GuidedSetupService) {}

  @Post('deploy')
  @UseGuards(OrgOwnerOrAdminGuard)
  @ApiOperation({
    summary: 'Atomically deploy a guided single-step queue or multi-step journey',
  })
  @RequirePermissions({ resource: 'queue', action: 'create' })
  async deploy(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const payload: GuidedSetupDeployInput = guidedSetupDeploySchema.parse(body);
    return this.guidedSetupService.deploy(user.orgId, user.userId, payload);
  }
}
