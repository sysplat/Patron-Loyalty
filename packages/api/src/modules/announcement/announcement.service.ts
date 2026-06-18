import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { orgLocalInclusiveRangeExclusiveEndUtc } from '../../common/org-local-dates';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';
import { resolveOrgIanaZone } from '../../common/resolve-org-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { RealtimeService } from '../realtime/realtime.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';

type AnnouncementSourceType = 'platform' | 'org';
type AnnouncementFeedChannel = 'dashboard' | 'display';

/**
 * Manages branch announcements for an organization.
 * Handles CRUD operations and public display querying.
 */
@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  /** Lobby displays and kiosks subscribe on `display:{branchId}` and `org:{orgId}`. */
  private async publishAnnouncementChanged(orgId: string, branchId: string | null): Promise<void> {
    const payload = { event: 'announcement.changed' as const, data: { orgId, branchId } };
    await this.realtime.publish(`org:${orgId}`, payload);
    if (branchId) {
      await this.realtime.publish(`display:${branchId}`, payload);
    }
  }

  /**
   * Returns the Prisma OR filter that matches currently active announcements.
   * An announcement is active when:
   * - both activeFrom/activeUntil are null (always active), or
   * - now falls within the [activeFrom, activeUntil] range, or
   * - only one bound is set and now satisfies that bound.
   */
  private buildActiveDateFilter(now: Date) {
    return [
      { activeFrom: null, activeUntil: null },
      { activeFrom: { lte: now }, activeUntil: { gte: now } },
      { activeFrom: null, activeUntil: { gte: now } },
      { activeFrom: { lte: now }, activeUntil: null },
    ];
  }

  private announcementVersion(updatedAt: Date | null | undefined, createdAt: Date): string {
    return (updatedAt ?? createdAt).toISOString();
  }

  private stateKey(
    sourceType: AnnouncementSourceType,
    announcementId: string,
    version: string,
  ): string {
    return `${sourceType}:${announcementId}:${version}`;
  }

  private normalizePolicy(input: {
    type: string;
    deliveryMode?: string;
    dismissBehavior?: string;
    requireAcknowledgment?: boolean;
  }) {
    const isCritical = input.type === 'critical';
    return {
      deliveryMode: input.deliveryMode ?? 'banner',
      dismissBehavior: isCritical ? 'disallowed' : (input.dismissBehavior ?? 'allowed'),
      requireAcknowledgment: isCritical ? true : (input.requireAcknowledgment ?? false),
    };
  }

  private async upsertState(input: {
    userId: string;
    orgId: string;
    sourceType: AnnouncementSourceType;
    announcementId: string;
    announcementVersion: string;
    dismissedAt?: Date | null;
    acknowledgedAt?: Date | null;
  }) {
    return this.prisma.withTenant(input.orgId, (tx) =>
      tx.announcementUserState.upsert({
        where: {
          userId_sourceType_announcementId_announcementVersion: {
            userId: input.userId,
            sourceType: input.sourceType,
            announcementId: input.announcementId,
            announcementVersion: input.announcementVersion,
          },
        },
        create: {
          userId: input.userId,
          orgId: input.orgId,
          sourceType: input.sourceType,
          announcementId: input.announcementId,
          announcementVersion: input.announcementVersion,
          seenAt: new Date(),
          dismissedAt: input.dismissedAt,
          acknowledgedAt: input.acknowledgedAt,
        },
        update: {
          seenAt: new Date(),
          dismissedAt: input.dismissedAt,
          acknowledgedAt: input.acknowledgedAt,
        },
      }),
    );
  }

  async getUnifiedFeedForPrincipal(
    orgId: string,
    userId: string,
    opts: { branchId?: string; channel?: AnnouncementFeedChannel } = {},
  ) {
    const channel = opts.channel ?? 'dashboard';
    if (channel !== 'dashboard') {
      throw new BadRequestException('Only dashboard channel is allowed for user feed');
    }

    const [platformItems, orgItems] = await Promise.all([
      this.prisma.platformAnnouncement.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.listForPrincipal(orgId, userId, opts.branchId),
    ]);

    const normalized = [
      ...platformItems.map((ann) => ({
        sourceType: 'platform' as const,
        announcementId: ann.id,
        version: this.announcementVersion(ann.updatedAt, ann.createdAt),
        title: ann.title,
        body: ann.body,
        severity: ann.type,
        createdAt: ann.createdAt,
        policy: {
          deliveryMode: ann.deliveryMode,
          dismissBehavior: ann.dismissBehavior,
          requireAcknowledgment: ann.requireAcknowledgment,
        },
        audience: {
          orgId: null as string | null,
          branchId: null as string | null,
          branchName: null as string | null,
        },
      })),
      ...orgItems.map((ann) => ({
        sourceType: 'org' as const,
        announcementId: ann.id,
        version: this.announcementVersion(ann.updatedAt, ann.createdAt),
        title: ann.branch?.name ? `${ann.branch.name} announcement` : 'Organization announcement',
        body: ann.message,
        severity: ann.type,
        createdAt: ann.createdAt,
        policy: {
          deliveryMode: ann.deliveryMode,
          dismissBehavior: ann.dismissBehavior,
          requireAcknowledgment: ann.requireAcknowledgment,
        },
        audience: {
          orgId: ann.orgId,
          branchId: ann.branchId ?? null,
          branchName: ann.branch?.name ?? null,
        },
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (normalized.length === 0) return [];

    const stateRows = await this.prisma.withTenant(orgId, (tx) =>
      tx.announcementUserState.findMany({
        where: {
          userId,
          OR: [
            {
              sourceType: 'platform',
              announcementId: {
                in: normalized
                  .filter((i) => i.sourceType === 'platform')
                  .map((i) => i.announcementId),
              },
            },
            {
              sourceType: 'org',
              announcementId: {
                in: normalized.filter((i) => i.sourceType === 'org').map((i) => i.announcementId),
              },
            },
          ],
        },
      }),
    );
    const stateMap = new Map(
      stateRows.map((s) => [
        this.stateKey(
          s.sourceType as AnnouncementSourceType,
          s.announcementId,
          s.announcementVersion,
        ),
        s,
      ]),
    );

    return normalized.map((item) => {
      const state = stateMap.get(this.stateKey(item.sourceType, item.announcementId, item.version));
      const dismissed = !!state?.dismissedAt;
      const acknowledged = !!state?.acknowledgedAt;
      const visible = item.policy.requireAcknowledgment ? !acknowledged : !dismissed;
      return {
        id: `${item.sourceType}:${item.announcementId}`,
        sourceType: item.sourceType,
        announcementId: item.announcementId,
        version: item.version,
        title: item.title,
        body: item.body,
        severity: item.severity,
        createdAt: item.createdAt,
        policy: item.policy,
        audience: item.audience,
        state: {
          seenAt: state?.seenAt ?? null,
          dismissedAt: state?.dismissedAt ?? null,
          acknowledgedAt: state?.acknowledgedAt ?? null,
          visible,
        },
      };
    });
  }

  async dismissForPrincipal(
    orgId: string,
    userId: string,
    sourceType: AnnouncementSourceType,
    announcementId: string,
  ) {
    const target = await this.resolveActionTargetForPrincipal(
      orgId,
      userId,
      sourceType,
      announcementId,
    );
    if (target.policy.requireAcknowledgment || target.policy.dismissBehavior === 'disallowed') {
      throw new BadRequestException('This announcement cannot be dismissed');
    }
    const row = await this.upsertState({
      userId,
      orgId,
      sourceType,
      announcementId,
      announcementVersion: target.version,
      dismissedAt: new Date(),
    });
    await this.platformAudit.log({
      actorUserId: userId,
      eventType: 'announcement.dismissed',
      severity: 'info',
      subjectOrgId: orgId,
      metadata: {
        sourceType,
        announcementId,
        announcementVersion: target.version,
      },
    });
    return row;
  }

  async acknowledgeForPrincipal(
    orgId: string,
    userId: string,
    sourceType: AnnouncementSourceType,
    announcementId: string,
  ) {
    const target = await this.resolveActionTargetForPrincipal(
      orgId,
      userId,
      sourceType,
      announcementId,
    );
    const row = await this.upsertState({
      userId,
      orgId,
      sourceType,
      announcementId,
      announcementVersion: target.version,
      acknowledgedAt: new Date(),
    });
    await this.platformAudit.log({
      actorUserId: userId,
      eventType: 'announcement.acknowledged',
      severity: target.policy.requireAcknowledgment ? 'warning' : 'info',
      subjectOrgId: orgId,
      metadata: {
        sourceType,
        announcementId,
        announcementVersion: target.version,
      },
    });
    return row;
  }

  async getComplianceForPrincipal(orgId: string, userId: string, id: string) {
    const ann = await this.getByIdForPrincipal(orgId, userId, id);
    const version = this.announcementVersion(ann.updatedAt, ann.createdAt);
    const [totals, acknowledged] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.announcementUserState.count({
          where: { sourceType: 'org', announcementId: id, announcementVersion: version, orgId },
        }),
        tx.announcementUserState.count({
          where: {
            sourceType: 'org',
            announcementId: id,
            announcementVersion: version,
            orgId,
            acknowledgedAt: { not: null },
          },
        }),
      ]),
    );
    return {
      sourceType: 'org' as const,
      announcementId: ann.id,
      version,
      totalInteractions: totals,
      acknowledgments: acknowledged,
      pendingAcknowledgments: Math.max(0, totals - acknowledged),
    };
  }

  async getPlatformComplianceForOperator(id: string) {
    const ann = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');
    const version = this.announcementVersion(ann.updatedAt, ann.createdAt);
    const [totals, acknowledged] = await this.prisma.withBypassRls((tx) =>
      Promise.all([
        tx.announcementUserState.count({
          where: { sourceType: 'platform', announcementId: id, announcementVersion: version },
        }),
        tx.announcementUserState.count({
          where: {
            sourceType: 'platform',
            announcementId: id,
            announcementVersion: version,
            acknowledgedAt: { not: null },
          },
        }),
      ]),
    );
    return {
      sourceType: 'platform' as const,
      announcementId: ann.id,
      version,
      totalInteractions: totals,
      acknowledgments: acknowledged,
      pendingAcknowledgments: Math.max(0, totals - acknowledged),
    };
  }

  private async resolveActionTargetForPrincipal(
    orgId: string,
    userId: string,
    sourceType: AnnouncementSourceType,
    announcementId: string,
  ) {
    if (sourceType === 'platform') {
      const ann = await this.prisma.platformAnnouncement.findUnique({
        where: { id: announcementId },
      });
      if (!ann || !ann.isActive) {
        throw new NotFoundException('Announcement not found');
      }
      return {
        version: this.announcementVersion(ann.updatedAt, ann.createdAt),
        policy: {
          dismissBehavior: ann.dismissBehavior,
          requireAcknowledgment: ann.requireAcknowledgment,
        },
      };
    }
    const ann = await this.getByIdForPrincipal(orgId, userId, announcementId);
    return {
      version: this.announcementVersion(ann.updatedAt, ann.createdAt),
      policy: {
        dismissBehavior: ann.dismissBehavior,
        requireAcknowledgment: ann.requireAcknowledgment,
      },
    };
  }

  /**
   * Reporting counts for announcements created in an organization-local date range
   * (`organizations.timezone`). Optional branch narrows to that branch plus organization-wide (null branchId) rows.
   */
  async getAnalyticsSummary(
    orgId: string,
    opts: {
      dateFrom: string;
      dateTo: string;
      branchId?: string;
      allowedBranchIds?: string[] | null;
    },
  ) {
    const branchFilter = opts.branchId?.trim();
    const reportTz = branchFilter
      ? await resolveBranchIanaZone(this.prisma, orgId, branchFilter)
      : await resolveOrgIanaZone(this.prisma, orgId);
    let start: Date;
    let endExclusive: Date;
    try {
      const r = orgLocalInclusiveRangeExclusiveEndUtc(reportTz, opts.dateFrom, opts.dateTo);
      start = r.start;
      endExclusive = r.endExclusive;
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_YMD') {
        throw new BadRequestException('dateFrom and dateTo must be yyyy-mm-dd');
      }
      if (e instanceof Error && e.message === 'FROM_AFTER_TO') {
        throw new BadRequestException('dateFrom must be on or before dateTo');
      }
      throw e;
    }
    const rangeMs = endExclusive.getTime() - start.getTime();
    const maxMs = 366 * 24 * 60 * 60 * 1000;
    if (rangeMs > maxMs) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    let scopeOr: Prisma.AnnouncementWhereInput['OR'] | undefined;
    if (branchFilter) {
      scopeOr = [{ branchId: branchFilter }, { branchId: null }];
    } else if (Array.isArray(opts.allowedBranchIds) && opts.allowedBranchIds.length === 0) {
      return {
        total: 0,
        dateFrom: opts.dateFrom.trim(),
        dateTo: opts.dateTo.trim(),
        byType: [],
        byScreen: [],
        byBranch: [],
      };
    } else if (opts.allowedBranchIds && opts.allowedBranchIds.length > 0) {
      scopeOr = [{ branchId: null }, { branchId: { in: opts.allowedBranchIds } }];
    }

    const where: Prisma.AnnouncementWhereInput = {
      orgId,
      createdAt: { gte: start, lt: endExclusive },
      ...(scopeOr ? { OR: scopeOr } : {}),
    };

    const [total, byType, byScreen, byBranchRaw] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.announcement.count({ where }),
        tx.announcement.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        tx.announcement.groupBy({
          by: ['displayOnScreen'],
          where,
          _count: { _all: true },
        }),
        tx.announcement.groupBy({
          by: ['branchId'],
          where,
          _count: { _all: true },
        }),
      ]),
    );

    const ids = [...new Set(byBranchRaw.map((r) => r.branchId).filter(Boolean))] as string[];
    const branchRows =
      ids.length > 0
        ? await this.prisma.withTenant(orgId, (tx) =>
            tx.branch.findMany({
              where: { id: { in: ids }, orgId },
              select: { id: true, name: true },
            }),
          )
        : [];
    const branchMap = new Map(branchRows.map((b) => [b.id, b.name]));

    const byBranch = byBranchRaw.map((row) => ({
      branchId: row.branchId,
      branchName:
        row.branchId == null
          ? 'Organization-wide'
          : (branchMap.get(row.branchId) ?? 'Unknown branch'),
      count: row._count._all,
    }));

    return {
      total,
      dateFrom: opts.dateFrom.trim(),
      dateTo: opts.dateTo.trim(),
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
      byScreen: byScreen.map((s) => ({
        displayOnScreen: s.displayOnScreen,
        count: s._count._all,
      })),
      byBranch,
    };
  }

  async list(orgId: string, branchId?: string, allowedBranchIds?: string[] | null) {
    const now = new Date();
    let branchScope: Prisma.AnnouncementWhereInput | undefined;
    if (branchId) {
      branchScope = { OR: [{ branchId }, { branchId: null }] };
    } else if (Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return [];
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      branchScope = { OR: [{ branchId: null }, { branchId: { in: allowedBranchIds } }] };
    }

    return this.prisma.withTenant(orgId, (tx) =>
      tx.announcement.findMany({
        where: {
          orgId,
          ...branchScope,
          AND: [{ OR: this.buildActiveDateFilter(now) }],
        },
        include: { branch: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async listForPrincipal(orgId: string, userId: string, branchId?: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.list(orgId, branchId, undefined);
    }
    return this.list(orgId, undefined, allowed);
  }

  async getAnalyticsSummaryForPrincipal(
    orgId: string,
    userId: string,
    opts: { dateFrom: string; dateTo: string; branchId?: string },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (opts.branchId?.trim()) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(opts.branchId.trim()))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.getAnalyticsSummary(orgId, { ...opts, allowedBranchIds: undefined });
    }
    return this.getAnalyticsSummary(orgId, { ...opts, allowedBranchIds: allowed });
  }

  async getByIdForPrincipal(orgId: string, userId: string, id: string) {
    const ann = await this.getById(orgId, id);
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed === null) {
      return ann;
    }
    if (allowed.length === 0) {
      throw new ForbiddenException('Branch not in your scope');
    }
    if (allowed === null || ann.branchId == null || allowed.includes(ann.branchId)) {
      return ann;
    }
    throw new ForbiddenException('Branch not in your scope');
  }

  /**
   * Returns active announcements visible on a branch display screen.
   * Scoped to the display device's organization (branch-specific + org-wide within that org).
   */
  async listActive(orgId: string, branchId: string) {
    const now = new Date();
    return this.prisma.withTenant(orgId, (tx) =>
      tx.announcement.findMany({
        where: {
          orgId,
          displayOnScreen: true,
          AND: [
            { OR: [{ branchId }, { branchId: null }] },
            { OR: this.buildActiveDateFilter(now) },
          ],
        },
        orderBy: [{ type: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async getById(orgId: string, id: string) {
    const ann = await this.prisma.withTenant(orgId, (tx) =>
      tx.announcement.findFirst({ where: { id, orgId } }),
    );
    if (!ann) throw new NotFoundException('Announcement not found');
    return ann;
  }

  async create(
    orgId: string,
    data: {
      branchId?: string;
      message: string;
      type?: string;
      deliveryMode?: string;
      dismissBehavior?: string;
      requireAcknowledgment?: boolean;
      displayOnScreen?: boolean;
      activeFrom?: string;
      activeUntil?: string;
    },
  ) {
    const type = data.type ?? 'info';
    const policy = this.normalizePolicy({
      type,
      deliveryMode: data.deliveryMode,
      dismissBehavior: data.dismissBehavior,
      requireAcknowledgment: data.requireAcknowledgment,
    });
    const created = await this.prisma.withTenant(orgId, (tx) =>
      tx.announcement.create({
        data: {
          orgId,
          branchId: data.branchId ?? null,
          message: data.message,
          type,
          deliveryMode: policy.deliveryMode,
          dismissBehavior: policy.dismissBehavior,
          requireAcknowledgment: policy.requireAcknowledgment,
          displayOnScreen: data.displayOnScreen ?? true,
          activeFrom: data.activeFrom ? new Date(data.activeFrom) : null,
          activeUntil: data.activeUntil ? new Date(data.activeUntil) : null,
        },
      }),
    );
    await this.publishAnnouncementChanged(orgId, created.branchId).catch((e: Error) =>
      this.logger.warn(`Realtime publish failed after announcement create: ${e.message}`),
    );
    return created;
  }

  async update(
    orgId: string,
    id: string,
    data: {
      message?: string;
      type?: string;
      deliveryMode?: string;
      dismissBehavior?: string;
      requireAcknowledgment?: boolean;
      displayOnScreen?: boolean;
      activeFrom?: string | null;
      activeUntil?: string | null;
    },
  ) {
    const existing = await this.getById(orgId, id);
    const nextType = data.type ?? existing.type;
    const policy = this.normalizePolicy({
      type: nextType,
      deliveryMode: data.deliveryMode ?? existing.deliveryMode,
      dismissBehavior: data.dismissBehavior ?? existing.dismissBehavior,
      requireAcknowledgment:
        data.requireAcknowledgment !== undefined
          ? data.requireAcknowledgment
          : existing.requireAcknowledgment,
    });
    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.announcement.update({
        where: { id },
        data: {
          ...data,
          type: nextType,
          deliveryMode: policy.deliveryMode,
          dismissBehavior: policy.dismissBehavior,
          requireAcknowledgment: policy.requireAcknowledgment,
          activeFrom:
            data.activeFrom !== undefined
              ? data.activeFrom
                ? new Date(data.activeFrom)
                : null
              : undefined,
          activeUntil:
            data.activeUntil !== undefined
              ? data.activeUntil
                ? new Date(data.activeUntil)
                : null
              : undefined,
        },
      }),
    );
    await this.publishAnnouncementChanged(orgId, updated.branchId).catch((e: Error) =>
      this.logger.warn(`Realtime publish failed after announcement update: ${e.message}`),
    );
    return updated;
  }

  async delete(orgId: string, id: string) {
    const existing = await this.getById(orgId, id);
    await this.prisma.withTenant(orgId, (tx) => tx.announcement.delete({ where: { id } }));
    await this.publishAnnouncementChanged(orgId, existing.branchId).catch((e: Error) =>
      this.logger.warn(`Realtime publish failed after announcement delete: ${e.message}`),
    );
  }
}
