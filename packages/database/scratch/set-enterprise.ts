import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'mehdi.shiravi@gmail.com';

  // 1. Find the user and their orgId
  const user = await prisma.user.findFirst({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    console.log(`User with email ${email} not found.`);
    return;
  }

  const orgId = user.orgId;
  console.log(`Found user ${user.email} in Org: ${user.organization.name} (${orgId})`);

  // 2. Find the enterprise plan
  const plan = await prisma.plan.findUnique({
    where: { slug: 'enterprise' },
  });

  if (!plan) {
    console.log('Enterprise plan not found in database.');
    return;
  }

  console.log(`Found Enterprise plan: ${plan.id}`);

  // 3. Update or Create the subscription
  const subscription = await prisma.subscription.findFirst({
    where: { orgId },
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        status: 'active',
        currentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 10)), // 10 years from now
      },
    });
    console.log('Updated existing subscription to Enterprise.');
  } else {
    await prisma.subscription.create({
      data: {
        orgId,
        planId: plan.id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
      },
    });
    console.log('Created new Enterprise subscription.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
