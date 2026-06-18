const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://queueplatform:queueplatform@localhost:5433/queueplatform',
});

// Helper to generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function main() {
  try {
    // Get the first organization
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.error('No organizations found. Please create one first.');
      process.exit(1);
    }

    console.log(`Using organization: ${org.name} (${org.id})`);

    // Create a test branch with a unique slug
    const branchName = `Downtown Test - ${Date.now()}`;
    const branch = await prisma.branch.create({
      data: {
        name: branchName,
        slug: generateSlug(branchName),
        address: '123 Main Street',
        phone: '+1-555-0001',
        status: 'active',
        orgId: org.id,
      },
    });

    console.log(`✓ Created branch: ${branch.name} (${branch.id})`);

    // Create a test service
    const service = await prisma.service.create({
      data: {
        name: 'Customer Service',
        slug: generateSlug('Customer Service'),
        description: 'General customer support',
        orgId: org.id,
      },
    });

    console.log(`✓ Created service: ${service.name} (${service.id})`);

    // Create an open queue
    const queue = await prisma.queue.create({
      data: {
        name: 'Main Queue',
        prefix: 'Q',
        status: 'open',
        orgId: org.id,
        branchId: branch.id,
        serviceId: service.id,
      },
    });

    console.log(`✓ Created queue: ${queue.name} (${queue.id})`);

    console.log('\n🎉 Test data created successfully!');
    console.log(`\n📍 Kiosk URL: http://localhost:3001/kiosk/${branch.id}`);
    console.log(`\n📝 Branch ID: ${branch.id}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
