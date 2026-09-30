import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
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
  constructor(
    private readonly program: LoyaltyProgramService,
    private readonly audit: AuditService,
  ) {}

  @Get('program')
  @ApiOperation({ summary: 'Get or bootstrap loyalty program config' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getProgram(@CurrentUser() user: AuthenticatedUser) {
    return this.program.getOrCreateProgram(user.orgId);
  }

  @Patch('program')
  @ApiOperation({ summary: 'Update loyalty program settings' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async updateProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateLoyaltyProgramDto,
  ) {
    const program = await this.program.updateProgram(user.orgId, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.PROGRAM_UPDATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_PROGRAM,
      resourceId: program.id,
      metadata: { changedKeys: Object.keys(body) },
    });
    return program;
  }

  @Post('program/tiers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createTier(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyTierDto) {
    const tier = await this.program.createTier(user.orgId, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.TIER_CREATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_TIER,
      resourceId: tier.id,
      metadata: { tierId: tier.id, name: tier.name },
    });
    return tier;
  }

  @Post('program/earn-rules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createEarnRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLoyaltyEarnRuleDto,
  ) {
    const rule = await this.program.createEarnRule(user.orgId, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_CREATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_EARN_RULE,
      resourceId: rule.id,
      metadata: { ruleId: rule.id },
    });
    return rule;
  }

  @Patch('program/earn-rules/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async updateEarnRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyEarnRuleDto,
  ) {
    const rule = await this.program.updateEarnRule(user.orgId, id, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_UPDATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_EARN_RULE,
      resourceId: id,
      metadata: { ruleId: id },
    });
    return rule;
  }
}
