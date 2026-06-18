import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from '../../common/audit/audit.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller({ path: 'organization/activity-logs', version: '1' })
export class OrganizationActivityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List org activity logs (admin+)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (max 100)' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action string' })
  @ApiQuery({ name: 'resourceType', required: false, description: 'Filter by resource type' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 start date filter' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 end date filter' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  async listActivityLogs(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '25', 10) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { orgId };
    if (action) where['action'] = { contains: action, mode: 'insensitive' };
    if (resourceType) where['resourceType'] = { equals: resourceType, mode: 'insensitive' };
    if (from || to) {
      where['createdAt'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [items, total] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        tx.activityLog.count({ where }),
      ]),
    );

    await this.audit.logActivity({
      orgId,
      userId,
      action: 'settings.audit_logs.viewed',
      resourceType: 'activity_log',
      metadata: {
        page,
        limit,
        actionFilter: action ?? null,
        resourceTypeFilter: resourceType ?? null,
      },
    });

    return {
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
