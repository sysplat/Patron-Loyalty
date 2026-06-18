const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { contains: 'parsa' } },
        include: {
            organization: true,
            roleAssignments: {
                include: {
                    role: {
                        include: {
                            rolePermissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            }
        }
    });

    for (const u of users) {
        console.log(`User: ${u.email} (ID: ${u.id}) - OrgID: ${u.orgId}`);
        for (const ra of u.roleAssignments) {
            console.log(`  Role: ${ra.role.name} - Permissions Count: ${ra.role.rolePermissions.length}`);
            const perms = ra.role.rolePermissions.map(rp => rp.permission.resource + ':' + rp.permission.action);
            // console.log(`  Perms: ${perms.join(', ')}`);
        }
        if (u.roleAssignments.length === 0) {
            console.log(`  NO ROLE ASSIGNMENTS!`);
        }
    }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
