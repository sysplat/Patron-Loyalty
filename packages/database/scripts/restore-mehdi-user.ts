import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from '@queueplatform/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Restoring organization and user for mehdi.shiravi@gmail.com...');

  // 1. Create Organization
  const orgSlug = 'sysplat';
  let org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Sysplat Organization',
        slug: orgSlug,
        status: 'active',
        visitJourneysEnabled: true,
        onboardingStep: 'completed',
      },
    });
    console.log(`✅ Created organization: ${org.name} (${org.id})`);
  } else {
    console.log(`ℹ️ Organization already exists: ${org.name} (${org.id})`);
  }

  // 2. Create Branch
  const branchName = 'Main Branch';
  const branchSlug = 'main-branch';
  let branch = await prisma.branch.findFirst({
    where: { orgId: org.id, name: branchName },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        orgId: org.id,
        name: branchName,
        slug: branchSlug,
        status: 'active',
        defaultJourneyMode: 'visit_multi_step',
      },
    });
    console.log(`✅ Created branch: ${branch.name} (${branch.id})`);
  } else {
    console.log(`ℹ️ Branch already exists: ${branch.name} (${branch.id})`);
  }

  // 3. Create Account & User
  const email = 'mehdi.shiravi@gmail.com';
  const password = 'Mehdi123456';
  const hash = await bcrypt.hash(password, 12);

  let acc = await prisma.account.findUnique({
    where: { email },
  });

  if (!acc) {
    acc = await prisma.account.create({
      data: {
        email,
        passwordHash: hash,
        emailVerified: true,
      },
    });
    console.log(`✅ Created Account for: ${email}`);
  }

  let user = await prisma.user.findFirst({
    where: { email, orgId: org.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        accountId: acc.id,
        orgId: org.id,
        email,
        passwordHash: hash,
        firstName: 'Mehdi',
        lastName: 'Shiravi',
        status: 'active',
        emailVerified: true,
      },
    });
    console.log(`✅ Created User: ${user.firstName} ${user.lastName} (${user.id})`);
  }

  // 4. Create Roles and Permissions for the organization
  const ownerRole = await prisma.role.upsert({
    where: { orgId_name: { orgId: org.id, name: SYSTEM_ROLES.OWNER } },
    update: {},
    create: {
      orgId: org.id,
      name: SYSTEM_ROLES.OWNER,
      isSystemRole: true,
      description: 'Organization Owner with full access',
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { orgId_name: { orgId: org.id, name: SYSTEM_ROLES.STAFF } },
    update: {},
    create: {
      orgId: org.id,
      name: SYSTEM_ROLES.STAFF,
      isSystemRole: true,
      description: 'Standard branch staff member',
    },
  });

  console.log('✅ Created roles');

  // Assign permissions to roles
  for (const roleName of [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.STAFF]) {
    const roleId = roleName === SYSTEM_ROLES.OWNER ? ownerRole.id : staffRole.id;
    const perms = DEFAULT_ROLE_PERMISSIONS[roleName] || [];

    for (const perm of perms) {
      const dbPerm = await prisma.permission.upsert({
        where: {
          resource_action_scope: {
            resource: perm.resource,
            action: perm.action,
            scope: perm.scope,
          },
        },
        update: {},
        create: perm,
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: dbPerm.id,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId: dbPerm.id,
        },
      });
    }
  }
  console.log('✅ Set up role permissions');

  // 5. Assign User to Owner Role
  await prisma.roleAssignment.upsert({
    where: {
      userId_roleId_branchId: {
        userId: user.id,
        roleId: ownerRole.id,
        branchId: null,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: ownerRole.id,
      branchId: null,
    },
  });
  console.log(`✅ Assigned Owner role to Mehdi for Main Branch`);

  console.log(`\n🎉 Restoration complete! User email: ${email}, Password: ${password}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
