import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_PLATFORM_ORG_SLUG } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RedisService } from '../../redis/redis.service';
import { PlanLimitService } from '../billing/plan-limit.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import {
  BulkTenantSuspendDto,
  TenantPlanSlugDto,
  TenantSuspendDto,
  TenantVisitJourneysDto,
  TenantAppointmentsDto,
  TenantPatronCrmDto,
  UpdateTenantProfileDto,
} from './dto/platform.dto';

const BULK_STATUS_MAX = 50;

type BulkStatusResultItem = { id: string; name?: string; slug?: string; reason: string };

export type BulkTenantStatusResult = {
  suspend: boolean;
  succeeded: { id: string; name: string; slug: string }[];
  skipped: BulkStatusResultItem[];
  failed: BulkStatusResultItem[];
};

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/tenants', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformTenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly planLimits: PlanLimitService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List organizations (paginated) for platform operators' })
  async list(
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('search') search?: string,
  ) {
    const skip = Math.max(0, parseInt(skipRaw ?? '0', 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(takeRaw ?? '30', 10) || 30));

    const where: any = {};
    if (search) {
      const s = search.trim();
      const or: any[] = [
        { name: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];

      // UUID fields in PostgreSQL don't support 'contains'.
      // We only add the ID filter if the search string looks like a valid UUID for an exact match.
      if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) {
        or.push({ id: s });
      }

      where.OR = or;
    }

    const [items, total, activeCount, suspendedCount] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          onboardingStep: true,
          createdAt: true,
          visitJourneysEnabled: true,
          appointmentsEnabled: true,
          patronCrmEnabled: true,
          subscriptions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              plan: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
      this.prisma.organization.count({ where: { ...where, NOT: { status: 'suspended' } } }),
      this.prisma.organization.count({ where: { ...where, status: 'suspended' } }),
    ]);
    return { success: true, data: { items, skip, take, total, activeCount, suspendedCount } };
  }

  @Post('bulk-status')
  @ApiOperation({ summary: 'Suspend or activate multiple tenant organizations' })
  async bulkStatus(@CurrentUser() operator: AuthenticatedUser, @Body() body: BulkTenantSuspendDto) {
    if (!Array.isArray(body.organizationIds) || body.organizationIds.length === 0) {
      throw new BadRequestException('organizationIds must be a non-empty array');
    }
    if (typeof body.suspend !== 'boolean') {
      throw new BadRequestException('suspend must be a boolean');
    }
    if (body.organizationIds.length > BULK_STATUS_MAX) {
      throw new BadRequestException(
        `Cannot update more than ${BULK_STATUS_MAX} organizations at once`,
      );
    }

    const uniqueIds = [
      ...new Set(body.organizationIds.map((id) => String(id).trim()).filter(Boolean)),
    ];
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, slug: true, status: true },
    });
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const result: BulkTenantStatusResult = {
      suspend: body.suspend,
      succeeded: [],
      skipped: [],
      failed: [],
    };

    for (const id of uniqueIds) {
      const org = orgById.get(id);
      if (!org) {
        result.failed.push({ id, reason: 'not_found' });
        continue;
      }

      if (org.slug === INTERNAL_PLATFORM_ORG_SLUG) {
        result.skipped.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          reason: 'platform_org_protected',
        });
        continue;
      }

      const isSuspended = org.status === 'suspended';
      if (body.suspend && isSuspended) {
        result.skipped.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          reason: 'already_suspended',
        });
        continue;
      }
      if (!body.suspend && !isSuspended) {
        result.skipped.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          reason: 'already_active',
        });
        continue;
      }

      await this.prisma.organization.update({
        where: { id: org.id },
        data: { status: body.suspend ? 'suspended' : 'active' },
      });
      await this.planLimits.invalidateLimitsCache(org.id);

      await this.audit.log({
        actorUserId: operator.userId,
        actorEmail: operator.email,
        eventType: body.suspend ? 'tenant.suspended' : 'tenant.activated',
        subjectOrgId: org.id,
        severity: body.suspend ? 'warning' : 'info',
        metadata: { orgSlug: org.slug, orgName: org.name, bulk: true },
      });

      result.succeeded.push({ id: org.id, name: org.name, slug: org.slug });
    }

    if (result.succeeded.length > 0) {
      await this.audit.log({
        actorUserId: operator.userId,
        actorEmail: operator.email,
        eventType: body.suspend ? 'tenant.bulk_suspended' : 'tenant.bulk_activated',
        severity: body.suspend ? 'warning' : 'info',
        metadata: {
          suspend: body.suspend,
          count: result.succeeded.length,
          organizationIds: result.succeeded.map((o) => o.id),
          skipped: result.skipped,
          failed: result.failed,
        },
      });
    }

    return { success: true, data: result };
  }

  @Get(':id/plan')
  @ApiOperation({
    summary: 'Read current subscription plan for a tenant (GET for tooling / prefetch)',
  })
  async getTenantPlan(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const sub = await this.prisma.withBypassRls((tx) =>
      tx.subscription.findFirst({
        where: { orgId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          plan: { select: { id: true, slug: true, name: true } },
        },
      }),
    );
    return {
      success: true,
      data: {
        orgId: org.id,
        subscriptionStatus: sub?.status ?? null,
        plan: sub?.plan ?? null,
      },
    };
  }

  @Get(':id/branches')
  @ApiOperation({ summary: 'List branches for impersonation role simulation' })
  async listTenantBranches(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const branches = await this.prisma.withTenant(id, (tx) =>
      tx.branch.findMany({
        where: { orgId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      }),
    );

    return { success: true, data: branches };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific tenant organization' })
  async getTenantDetails(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
            queues: true,
            tickets: true,
          },
        },
        subscriptions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            plan: true,
          },
        },
        smsCreditPurchases: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return { success: true, data: org };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update basic organization profile details' })
  async updateProfile(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTenantProfileDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (body.slug && body.slug !== org.slug) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: body.slug },
      });
      if (existing) {
        throw new BadRequestException('Organization slug is already in use');
      }
    }

    const updateData: any = {
      name: body.name,
      slug: body.slug,
      website: body.website === '' ? null : body.website,
      industry: body.industry === '' ? null : body.industry,
      timezone: body.timezone,
      country: body.country === '' ? null : body.country,
    };

    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key],
    );

    const updated = await this.prisma.organization.update({
      where: { id },
      data: updateData,
    });

    await this.planLimits.invalidateLimitsCache(id);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'tenant.profile_updated',
      subjectOrgId: id,
      severity: 'info',
      metadata: {
        orgSlug: org.slug,
        changes: { ...body },
      },
    });

    return { success: true, data: updated };
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend or activate a tenant organization' })
  async toggleSuspend(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TenantSuspendDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (org.slug === INTERNAL_PLATFORM_ORG_SLUG) {
      throw new BadRequestException('The internal platform organization cannot be suspended.');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status: body.suspend ? 'suspended' : 'active' },
    });

    await this.planLimits.invalidateLimitsCache(id);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: body.suspend ? 'tenant.suspended' : 'tenant.activated',
      subjectOrgId: id,
      severity: body.suspend ? 'warning' : 'info',
      metadata: { orgSlug: org.slug, orgName: org.name },
    });

    return { success: true, data: updated };
  }

  @Patch(':id/visit-journeys')
  @ApiOperation({
    summary:
      'Enable or disable Visit journeys for a tenant (org-level issuance gate for multi-step visits)',
  })
  async setVisitJourneys(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TenantVisitJourneysDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (this.config.get<boolean>('app.visitJourneysGloballyDisabled', false)) {
      throw new BadRequestException(
        'Visit journeys are disabled for this deployment (FEATURE_VISIT_JOURNEYS=false).',
      );
    }
    if (this.config.get<boolean>('app.visitJourneysLegacyGlobalOn', false)) {
      throw new BadRequestException(
        'Visit journeys are enabled platform-wide on this deployment; the tenant toggle cannot be changed.',
      );
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { visitJourneysEnabled: body.visitJourneysEnabled === true },
    });

    await this.planLimits.invalidateLimitsCache(id);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'tenant.visit_journeys_updated',
      subjectOrgId: id,
      severity: 'info',
      metadata: {
        orgSlug: org.slug,
        visitJourneysEnabled: updated.visitJourneysEnabled,
      },
    });

    return {
      success: true,
      data: { id: updated.id, visitJourneysEnabled: updated.visitJourneysEnabled },
    };
  }

  @Patch(':id/appointments')
  @ApiOperation({
    summary: 'Enable or disable Appointments module for a tenant',
  })
  async setAppointments(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TenantAppointmentsDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { appointmentsEnabled: body.appointmentsEnabled === true },
    });

    await this.planLimits.invalidateLimitsCache(id);

    // Also invalidate the appointments feature guard cache
    const cacheKey = `feature:appointmentsEnabled:${id}`;
    await this.redis.del(cacheKey);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'tenant.appointments_updated',
      subjectOrgId: id,
      severity: 'info',
      metadata: {
        orgSlug: org.slug,
        appointmentsEnabled: updated.appointmentsEnabled,
      },
    });

    return {
      success: true,
      data: { id: updated.id, appointmentsEnabled: updated.appointmentsEnabled },
    };
  }

  @Patch(':id/patron-crm')
  @ApiOperation({
    summary: 'Enable or disable Patron CRM for a tenant',
  })
  async setPatronCrm(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TenantPatronCrmDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { patronCrmEnabled: body.patronCrmEnabled === true },
    });

    await this.patronCrmFeature.invalidateCache(id);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'tenant.patron_crm_updated',
      subjectOrgId: id,
      severity: 'info',
      metadata: {
        orgSlug: org.slug,
        patronCrmEnabled: updated.patronCrmEnabled,
      },
    });

    return {
      success: true,
      data: { id: updated.id, patronCrmEnabled: updated.patronCrmEnabled },
    };
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Manually override the plan for a tenant' })
  async overridePlan(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TenantPlanSlugDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const plan = await this.prisma.plan.findUnique({ where: { slug: body.planSlug } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    let sub = await this.prisma.withBypassRls((tx) =>
      tx.subscription.findFirst({
        where: { orgId: id },
        orderBy: { createdAt: 'desc' },
      }),
    );

    const oldPlanId = sub?.planId;

    if (sub) {
      sub = await this.prisma.withTenant(id, (tx) =>
        tx.subscription.update({
          where: { id: sub!.id },
          data: { planId: plan.id, status: 'active' },
        }),
      );
    } else {
      const now = new Date();
      sub = await this.prisma.withTenant(id, (tx) =>
        tx.subscription.create({
          data: {
            orgId: id,
            planId: plan.id,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
          },
        }),
      );
    }

    await this.planLimits.invalidateLimitsCache(id);

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'tenant.plan_overridden',
      subjectOrgId: id,
      severity: 'info',
      metadata: {
        orgSlug: org.slug,
        newPlan: body.planSlug,
        oldPlanId: oldPlanId || null,
      },
    });

    return { success: true, data: sub };
  }
}
