import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_ROLES, hasLoyaltyProduct, hasQueueProduct } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Manages organization-level data and settings.
 * Handles profile updates, billing plan info, and member counts.
 */
@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private async isOrgOwner(orgId: string, userId: string): Promise<boolean> {
    const ownerRole = await this.prisma.withTenant(orgId, (tx) =>
      tx.role.findFirst({
        where: { orgId, name: SYSTEM_ROLES.OWNER, isSystemRole: true },
        select: { id: true },
      }),
    );
    if (!ownerRole) return false;
    const assignment = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findFirst({
        where: { userId, roleId: ownerRole.id },
        select: { id: true },
      }),
    );
    return Boolean(assignment);
  }

  private async isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    const adminRole = await this.prisma.withTenant(orgId, (tx) =>
      tx.role.findFirst({
        where: { orgId, name: SYSTEM_ROLES.ADMIN, isSystemRole: true },
        select: { id: true },
      }),
    );
    if (!adminRole) return false;
    const assignment = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findFirst({
        where: { userId, roleId: adminRole.id },
        select: { id: true },
      }),
    );
    return Boolean(assignment);
  }

  private readonly organizationSelect = {
    id: true,
    name: true,
    slug: true,
    website: true,
    industry: true,
    timezone: true,
    country: true,
    logoUrl: true,
    onboardingStep: true,
    createdAt: true,
    visitJourneysEnabled: true,
    appointmentsEnabled: true,
    patronCrmEnabled: true,
    productSku: true,
  } as const;

  private productFlags(row: { productSku: string; patronCrmEnabled: boolean }) {
    return {
      productSku: row.productSku,
      hasQueueProduct: hasQueueProduct(row.productSku),
      hasLoyaltyProduct: hasLoyaltyProduct(row.productSku, row.patronCrmEnabled),
    };
  }

  private journeyFlags() {
    return {
      visitJourneysPlatformLocked: this.config.get<boolean>(
        'app.visitJourneysGloballyDisabled',
        false,
      ),
      visitJourneysLegacyGlobalOn: this.config.get<boolean>(
        'app.visitJourneysLegacyGlobalOn',
        false,
      ),
    };
  }

  private stripLogoFromOrganizationRow<T extends { logoUrl: string | null }>(
    row: T,
  ): Omit<T, 'logoUrl'> & { hasLogo: boolean } {
    const { logoUrl, ...profile } = row;
    return {
      ...profile,
      hasLogo: Boolean(logoUrl?.trim()),
    };
  }

  async getOrganization(orgId: string) {
    const row = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: this.organizationSelect,
    });
    return {
      ...row,
      ...this.journeyFlags(),
      ...this.productFlags(row),
    };
  }

  /** Profile fields without logo payload (faster settings page load). */
  async getOrganizationProfile(orgId: string) {
    const row = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: this.organizationSelect,
    });
    return {
      ...this.stripLogoFromOrganizationRow(row),
      ...this.journeyFlags(),
      ...this.productFlags(row),
    };
  }

  async getOrganizationLogo(orgId: string) {
    const row = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { logoUrl: true },
    });
    return { logoUrl: row.logoUrl };
  }

  /** Single round-trip for Settings → Organization tab. */
  async getSettingsPageInit(orgId: string) {
    const [orgRow, kioskSetting] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: this.organizationSelect,
      }),
      this.prisma.withTenant(orgId, (tx) =>
        tx.setting.findFirst({
          where: { orgId, key: 'kiosk_name_required', scope: 'org' },
          select: { value: true },
        }),
      ),
    ]);

    return {
      organization: {
        ...this.stripLogoFromOrganizationRow(orgRow),
        ...this.journeyFlags(),
        ...this.productFlags(orgRow),
      },
      kioskNameRequired: kioskSetting?.value === true,
    };
  }

  async updateOrganization(
    orgId: string,
    actorUserId: string,
    data: {
      name?: string;
      website?: string;
      industry?: string;
      timezone?: string;
      country?: string;
      logoUrl?: string;
      visitJourneysEnabled?: boolean;
    },
  ) {
    const allowedKeys = ['name', 'website', 'industry', 'timezone', 'country', 'logoUrl'] as const;
    const payload: Partial<Record<(typeof allowedKeys)[number], string>> = {};
    for (const key of allowedKeys) {
      if (data[key] !== undefined) {
        payload[key] = data[key] as string;
      }
    }

    const visitToggle = data.visitJourneysEnabled;
    const hasProfileUpdates = Object.keys(payload).length > 0;
    const hasVisitToggle = visitToggle !== undefined;

    if (!hasProfileUpdates && !hasVisitToggle) {
      return this.getOrganization(orgId);
    }

    const owner = await this.isOrgOwner(orgId, actorUserId);
    const admin = await this.isOrgAdmin(orgId, actorUserId);

    if (hasProfileUpdates && !owner) {
      throw new ForbiddenException(
        'Only an organization owner may update organization profile fields.',
      );
    }

    if (hasVisitToggle && !owner && !admin) {
      throw new ForbiddenException(
        'Only an organization owner or admin may enable or disable visit journeys.',
      );
    }

    if (visitToggle !== undefined) {
      if (this.config.get<boolean>('app.visitJourneysGloballyDisabled', false)) {
        throw new BadRequestException('Visit journeys are disabled for this deployment.');
      }
      if (this.config.get<boolean>('app.visitJourneysLegacyGlobalOn', false)) {
        throw new BadRequestException(
          'Visit journeys are enabled platform-wide on this deployment; the organization toggle cannot be changed.',
        );
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...payload,
        ...(visitToggle !== undefined ? { visitJourneysEnabled: visitToggle } : {}),
      },
    });

    if (payload.timezone) {
      await this.redis.del(`org:timezone:${orgId}`);
    }

    return updated;
  }
}
