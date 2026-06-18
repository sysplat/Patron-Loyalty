import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DEFAULT_SMS_CREDITS_BY_PLAN_SLUG } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { syncSystemRolePermissions } from '../rbac/system-role-permissions';

const RESOURCES = [
  'organization',
  'branch',
  'service',
  'queue',
  'ticket',
  'appointment',
  'desk',
  'announcement',
  'user',
  'role',
  'report',
  'billing',
  'display',
  'notification',
  'settings',
  'review',
  'customer',
  'station_profile',
] as const;

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
const SCOPES = ['own', 'branch', 'org'] as const;

/**
 * Ensures global seed data (plans, permissions, feature flags) exists in the
 * database on every application startup. Safe to run multiple times (upsert).
 * This guarantees production deployments always have the required base data
 * even if the manual seed script was never run.
 */
@Injectable()
export class StartupSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedPermissions();
    this.backfillOrgsWithoutRoles().catch((e) => this.logger.error(e));
    await this.seedPlans();
    await this.seedFeatureFlags();
  }

  // ─── Permissions ──────────────────────────────────────────────────────────

  private async seedPermissions(): Promise<void> {
    const existing = await this.prisma.permission.count();
    const expected = RESOURCES.length * ACTIONS.length * SCOPES.length;

    if (existing >= expected) {
      this.logger.log(`Permissions already seeded (${existing}/${expected})`);
      // We no longer sync all orgs on every startup to improve boot time.
      // Synchronization is now handled lazily on login.
      return;
    }

    this.logger.log(`Seeding permissions (found ${existing}, expected ${expected})…`);
    let count = 0;
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        for (const scope of SCOPES) {
          await this.prisma.permission.upsert({
            where: { resource_action_scope: { resource, action, scope } },
            update: {},
            create: { resource, action, scope },
          });
          count++;
        }
      }
    }
    this.logger.log(`✓ ${count} permissions seeded`);
  }

  // ─── Synchronize system-role permissions for existing orgs ───────────────
  // This method is now deprecated for global startup use.
  // Kept for manual backfill use if needed in the future.
  private async syncExistingSystemRolePermissions(): Promise<void> {
    // Implementation removed from automatic startup loop to prevent boot delays.
  }

  // ─── Backfill orgs that have zero roles (registered before role seeding) ──

  private async backfillOrgsWithoutRoles(): Promise<void> {
    // Find orgs that have no roles at all
    const orgsWithoutRoles = await this.prisma.organization.findMany({
      where: { roles: { none: {} } },
      select: { id: true, name: true },
    });

    if (orgsWithoutRoles.length === 0) {
      this.logger.log('All orgs already have roles');
      return;
    }

    this.logger.log(`Backfilling system roles for ${orgsWithoutRoles.length} org(s)…`);

    for (const org of orgsWithoutRoles) {
      const systemRoles = await syncSystemRolePermissions(this.prisma, org.id, true);
      const ownerRoleId = systemRoles.owner;

      // Assign the owner role to every user in this org who has no role assignment
      const usersWithoutRole = await this.prisma.withBypassRls((tx) =>
        tx.user.findMany({
          where: { orgId: org.id, roleAssignments: { none: {} } },
          select: { id: true },
        }),
      );
      if (usersWithoutRole.length > 0) {
        await this.prisma.withBypassRls((tx) =>
          tx.roleAssignment.createMany({
            data: usersWithoutRole.map((u) => ({ userId: u.id, roleId: ownerRoleId })),
            skipDuplicates: true,
          }),
        );
        this.logger.log(
          `  → org "${org.name}": created roles + assigned owner to ${usersWithoutRole.length} user(s)`,
        );
      } else {
        this.logger.log(`  → org "${org.name}": created roles (users already have assignments)`);
      }
    }

    this.logger.log(`✓ Backfilled roles for ${orgsWithoutRoles.length} org(s)`);
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  private async seedPlans(): Promise<void> {
    const plans = [
      {
        name: 'Free',
        slug: 'free',
        priceMonthly: 0,
        priceYearly: 0,
        features: {
          queueManagement: true,
          onlineBooking: true,
          emailNotifications: true,
          basicReports: true,
          appointments: false,
          smsNotifications: true,
          advancedReports: false,
          customBranding: false,
          apiAccess: false,
          digitalSignage: false,
        },
        limits: {
          maxBranches: 1,
          maxUsers: 3,
          maxQueuesPerBranch: 3,
          maxTicketsPerMonth: 100,
          maxDevices: 1,
          hasAdvancedReports: false,
          hasCustomBranding: false,
          hasSmsNotifications: true,
          hasApiAccess: false,
          smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.free,
        },
      },
      {
        name: 'Professional',
        slug: 'professional',
        priceMonthly: 49,
        priceYearly: 470,
        features: {
          queueManagement: true,
          onlineBooking: true,
          emailNotifications: true,
          basicReports: true,
          appointments: true,
          smsNotifications: true,
          advancedReports: false,
          customBranding: false,
          apiAccess: false,
          digitalSignage: true,
        },
        limits: {
          maxBranches: 3,
          maxUsers: 10,
          maxQueuesPerBranch: 10,
          maxTicketsPerMonth: 1000,
          maxDevices: 5,
          hasAdvancedReports: false,
          hasCustomBranding: false,
          hasSmsNotifications: true,
          hasApiAccess: false,
          smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.professional,
        },
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        priceMonthly: 149,
        priceYearly: 1430,
        features: {
          queueManagement: true,
          onlineBooking: true,
          emailNotifications: true,
          basicReports: true,
          appointments: true,
          smsNotifications: true,
          advancedReports: true,
          customBranding: true,
          apiAccess: true,
          digitalSignage: true,
        },
        limits: {
          maxBranches: 20,
          maxUsers: 50,
          maxQueuesPerBranch: 50,
          maxTicketsPerMonth: 10000,
          maxDevices: 50,
          hasAdvancedReports: true,
          hasCustomBranding: true,
          hasSmsNotifications: true,
          hasApiAccess: true,
          smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.enterprise,
        },
      },
      {
        name: 'Loyalty Starter',
        slug: 'loyalty-starter',
        priceMonthly: 29,
        priceYearly: 278,
        features: {
          queueManagement: false,
          onlineBooking: false,
          emailNotifications: true,
          basicReports: true,
          appointments: false,
          smsNotifications: true,
          advancedReports: false,
          customBranding: false,
          apiAccess: false,
          digitalSignage: false,
          patronLoyalty: true,
        },
        limits: {
          maxBranches: 1,
          maxUsers: 5,
          maxQueuesPerBranch: 0,
          maxTicketsPerMonth: 0,
          maxDevices: 0,
          hasAdvancedReports: false,
          hasCustomBranding: false,
          hasSmsNotifications: true,
          hasApiAccess: false,
          hasCrmIntegration: true,
          smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG['loyalty-starter'],
        },
      },
    ];

    for (const plan of plans) {
      await this.prisma.plan.upsert({ where: { slug: plan.slug }, update: plan, create: plan });
    }
    this.logger.log(`✓ ${plans.length} plans synced (incl. loyalty starter)`);
  }

  // ─── Feature Flags ────────────────────────────────────────────────────────

  private async seedFeatureFlags(): Promise<void> {
    const existing = await this.prisma.featureFlag.count();
    if (existing >= 6) return;

    const flags = [
      { name: 'ai_wait_prediction', enabled: false, rolloutPercentage: 0 },
      { name: 'ai_staff_suggestion', enabled: false, rolloutPercentage: 0 },
      { name: 'appointments_module', enabled: false, rolloutPercentage: 0 },
      { name: 'retail_module', enabled: false, rolloutPercentage: 0 },
      { name: 'sms_notifications', enabled: true, rolloutPercentage: 100 },
      { name: 'voice_announcements', enabled: true, rolloutPercentage: 100 },
    ];

    for (const flag of flags) {
      await this.prisma.featureFlag.upsert({
        where: { name: flag.name },
        update: {},
        create: flag,
      });
    }
    this.logger.log(`✓ ${flags.length} feature flags seeded`);
  }
}
