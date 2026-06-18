'use strict';
// ──────────────────────────────────────────────────
// Database Seed — Plans, Permissions, System Defaults
// Run: pnpm db:seed
// ──────────────────────────────────────────────────
Object.defineProperty(exports, '__esModule', { value: true });
const client_1 = require('@prisma/client');
const prisma = new client_1.PrismaClient();
const RESOURCES = [
  'organization',
  'branch',
  'service',
  'queue',
  'ticket',
  'appointment',
  'user',
  'role',
  'report',
  'billing',
  'display',
  'notification',
  'settings',
  'review',
];
const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'];
const SCOPES = ['own', 'branch', 'org'];
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
        smsNotifications: false,
        advancedReports: false,
        customBranding: false,
        apiAccess: false,
        digitalSignage: false,
      },
      limits: {
        maxBranches: 1,
        maxUsers: 3,
        maxQueuesPerBranch: 3,
        maxTicketsPerDay: 100,
        maxDevices: 1,
        hasAdvancedReports: false,
        hasCustomBranding: false,
        hasSmsNotifications: false,
        hasApiAccess: false,
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
        maxTicketsPerDay: 1000,
        maxDevices: 5,
        hasAdvancedReports: false,
        hasCustomBranding: false,
        hasSmsNotifications: true,
        hasApiAccess: false,
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
        maxTicketsPerDay: 10000,
        maxDevices: 50,
        hasAdvancedReports: true,
        hasCustomBranding: true,
        hasSmsNotifications: true,
        hasApiAccess: true,
      },
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
//# sourceMappingURL=seed.js.map
