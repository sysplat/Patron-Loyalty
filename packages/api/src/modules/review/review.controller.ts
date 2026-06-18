import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateReviewDto, ModerateReviewDto } from './dto/review.dto';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List reviews' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'rating', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Match name, email, or comment (case-insensitive)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'review', action: 'read' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewService.listForPrincipal(user.orgId, user.userId, {
      branchId,
      rating: rating ? +rating : undefined,
      status,
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review (public, for customers)' })
  create(@Body() body: CreateReviewDto) {
    return this.reviewService.create(body.orgId, body);
  }

  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Approve or reject a review' })
  @RequirePermissions({ resource: 'review', action: 'update' })
  moderate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ModerateReviewDto,
  ) {
    return this.reviewService.moderate(user.orgId, id, body.action);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @RequirePermissions({ resource: 'review', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.reviewService.delete(user.orgId, id);
  }

  @Get('stats')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Get review statistics' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'review', action: 'read' })
  stats(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    return this.reviewService.getStatsForPrincipal(user.orgId, user.userId, branchId);
  }
}
