// ──────────────────────────────────────────────────
// Database Seed — Plans, Permissions, System Defaults
// Run: pnpm db:seed
// ──────────────────────────────────────────────────

import { DEFAULT_SMS_CREDITS_BY_PLAN_SLUG, LOYALTY_STARTER } from '@queueplatform/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
] as const;

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
const SCOPES = ['own', 'branch', 'org'] as const;

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Seed Plans ──────────────────────────────
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
      name: LOYALTY_STARTER.name,
      slug: LOYALTY_STARTER.slug,
      priceMonthly: LOYALTY_STARTER.priceMonthly,
      priceYearly: LOYALTY_STARTER.priceYearly,
      features: LOYALTY_STARTER.features,
      limits: LOYALTY_STARTER.limits,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }
  console.log(`  ✓ ${plans.length} plans seeded`);

  // ─── Seed Permissions ────────────────────────
  let permCount = 0;
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      for (const scope of SCOPES) {
        await prisma.permission.upsert({
          where: {
            resource_action_scope: { resource, action, scope },
          },
          update: {},
          create: { resource, action, scope },
        });
        permCount++;
      }
    }
  }
  console.log(`  ✓ ${permCount} permissions seeded`);

  // ─── Seed Default Feature Flags ──────────────
  const flags = [
    { name: 'ai_wait_prediction', enabled: false, rolloutPercentage: 0 },
    { name: 'ai_staff_suggestion', enabled: false, rolloutPercentage: 0 },
    { name: 'appointments_module', enabled: false, rolloutPercentage: 0 },
    { name: 'retail_module', enabled: false, rolloutPercentage: 0 },
    { name: 'sms_notifications', enabled: true, rolloutPercentage: 100 },
    { name: 'voice_announcements', enabled: true, rolloutPercentage: 100 },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: { enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage },
      create: flag,
    });
  }
  console.log(`  ✓ ${flags.length} feature flags seeded`);

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
