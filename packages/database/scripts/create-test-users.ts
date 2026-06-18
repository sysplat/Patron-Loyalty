import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No org found');

  const branch = await prisma.branch.findFirst({ where: { orgId: org.id } });
  if (!branch) throw new Error('No branch found');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const roles = await prisma.role.findMany({ where: { orgId: org.id } });

  for (const roleName of ['owner', 'admin', 'manager', 'staff']) {
    const role = roles.find((r) => r.name === roleName);
    if (!role) continue;

    const email = `test.${roleName}@qms.local`;

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          orgId: org.id,
          email,
          passwordHash,
          firstName: 'Test',
          lastName: roleName,
          emailVerified: new Date(),
        },
      });
    }

    // Ensure role assignment
    const existingRole = await prisma.roleAssignment.findFirst({
      where: { userId: user.id },
    });

    if (!existingRole) {
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          roleId: role.id,
          branchId: roleName === 'owner' || roleName === 'admin' ? null : branch.id,
        },
      });
    }
    console.log(`Created/Verified ${email} with role ${roleName} (Password123!)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
