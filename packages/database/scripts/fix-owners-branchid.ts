import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(
    'Searching for OWNER or ADMIN role assignments that have a branchId set incorrectly...',
  );

  const badAssignments = await prisma.roleAssignment.findMany({
    where: {
      branchId: { not: null },
      role: {
        name: { in: ['owner', 'admin'] },
      },
    },
    include: {
      user: { select: { email: true } },
      role: { select: { name: true } },
    },
  });

  if (badAssignments.length === 0) {
    console.log('No incorrect owner/admin role assignments found. Everything is clean!');
    return;
  }

  console.log(`Found ${badAssignments.length} bad assignments. Fixing them...`);

  for (const assignment of badAssignments) {
    console.log(
      `Fixing user ${assignment.user.email} (Role: ${assignment.role.name}). Resetting branchId to null.`,
    );
    await prisma.roleAssignment.update({
      where: { id: assignment.id },
      data: { branchId: null },
    });
  }

  console.log('✅ All affected owner/admin users have been fixed to be organization-wide.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
