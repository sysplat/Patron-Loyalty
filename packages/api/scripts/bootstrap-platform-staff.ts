import { PrismaClient } from '@prisma/client';
import { INTERNAL_PLATFORM_ORG_SLUG } from '@queueplatform/shared';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function run() {
  console.log('🚀 Bootstrapping Platform Staff organization and first admin...');

  try {
    const orgSlug = INTERNAL_PLATFORM_ORG_SLUG;
    let org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'QlessQ Internal Staff',
          slug: orgSlug,
          status: 'active',
        },
      });
      console.log(`✅ Created internal organization: ${org.id}`);
    } else {
      console.log(`ℹ️ Internal organization already exists: ${org.id}`);
    }

    const adminEmail = 'parsasamandizadeh@gmail.com';
    const password = 'Parsa123456';
    const hash = await bcrypt.hash(password, 12);

    let user = await prisma.user.findFirst({
      where: { email: adminEmail, orgId: org.id },
    });

    if (!user) {
      const acc =
        (await prisma.account.findUnique({ where: { email: adminEmail } })) ??
        (await prisma.account.create({
          data: {
            email: adminEmail,
            passwordHash: hash,
            emailVerified: true,
            phone: null,
          },
        }));

      user = await prisma.user.create({
        data: {
          accountId: acc.id,
          email: adminEmail,
          passwordHash: acc.passwordHash,
          firstName: 'Parsa',
          lastName: 'Samandi',
          status: 'active',
          emailVerified: true,
          orgId: org.id,
        },
      });
      console.log(`✅ Created initial platform admin: ${user.email}`);
    } else {
      if (!user.accountId) {
        const acc = await prisma.account.create({
          data: {
            email: adminEmail,
            passwordHash: hash,
            emailVerified: true,
            phone: null,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountId: acc.id,
            orgId: org.id,
            passwordHash: hash,
            status: 'active',
            emailVerified: true,
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            orgId: org.id,
            passwordHash: hash,
            status: 'active',
          },
        });
        await prisma.account.update({
          where: { id: user.accountId },
          data: { passwordHash: hash, emailVerified: true },
        });
        await prisma.user.updateMany({
          where: { accountId: user.accountId },
          data: { passwordHash: hash, emailVerified: true },
        });
      }
      console.log(`✅ Updated existing user to platform admin: ${user.email}`);
    }

    console.log('🎉 Bootstrap complete!');
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
