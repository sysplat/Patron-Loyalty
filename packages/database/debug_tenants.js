const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugTenants() {
  try {
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.organization.count(),
    ]);

    console.log('API-like Response:');
    console.log(JSON.stringify({ success: true, data: { items, total } }, null, 2));
  } catch (error) {
    console.error('Error fetching tenants:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTenants();
