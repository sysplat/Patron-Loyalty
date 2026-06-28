import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyGamificationService } from '../loyalty-gamification.service';
import { CreateLoyaltyBadgeDto, CreateLoyaltyChallengeDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyGamificationController {
  constructor(private readonly gamification: LoyaltyGamificationService) {}

  @Get('badges')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.listBadges(user.orgId);
  }

  @Post('badges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createBadge(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyBadgeDto) {
    return this.gamification.createBadge(user.orgId, body);
  }

  @Get('challenges')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listChallenges(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.listChallenges(user.orgId);
  }

  @Post('challenges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createChallenge(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyChallengeDto) {
    return this.gamification.createChallenge(user.orgId, {
      ...body,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    });
  }
}
