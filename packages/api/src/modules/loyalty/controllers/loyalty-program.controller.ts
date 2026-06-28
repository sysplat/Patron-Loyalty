import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyProgramService } from '../loyalty-program.service';
import {
  CreateLoyaltyEarnRuleDto,
  CreateLoyaltyTierDto,
  UpdateLoyaltyEarnRuleDto,
  UpdateLoyaltyProgramDto,
} from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyProgramController {
  constructor(private readonly program: LoyaltyProgramService) {}

  @Get('program')
  @ApiOperation({ summary: 'Get or bootstrap loyalty program config' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getProgram(@CurrentUser() user: AuthenticatedUser) {
    return this.program.getOrCreateProgram(user.orgId);
  }

  @Patch('program')
  @ApiOperation({ summary: 'Update loyalty program settings' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateProgram(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateLoyaltyProgramDto) {
    return this.program.updateProgram(user.orgId, body);
  }

  @Post('program/tiers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createTier(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyTierDto) {
    return this.program.createTier(user.orgId, body);
  }

  @Post('program/earn-rules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createEarnRule(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyEarnRuleDto) {
    return this.program.createEarnRule(user.orgId, body);
  }

  @Patch('program/earn-rules/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateEarnRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyEarnRuleDto,
  ) {
    return this.program.updateEarnRule(user.orgId, id, body);
  }
}
