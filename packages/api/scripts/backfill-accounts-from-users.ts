/**
 * One-time (or idempotent): create `accounts` rows and set `users.account_id`
 * grouped by lower(email). Canonical credentials = oldest user row (created_at).
 *
 * Run after migration `20260513120000_add_accounts` against the target database:
 *   pnpm --filter @queueplatform/api exec tsx scripts/backfill-accounts-from-users.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { accountId: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerified: true,
      phone: true,
    },
  });

  const byEmail = new Map<string, typeof users>();
  for (const u of users) {
    const k = u.email.toLowerCase();
    if (!byEmail.has(k)) byEmail.set(k, []);
    byEmail.get(k)!.push(u);
  }

  let groups = 0;
  for (const [email, group] of byEmail) {
    const canonical = group[0];
    const hashes = new Set(group.map((g) => g.passwordHash));
    if (hashes.size > 1) {
      console.warn(
        `[backfill-accounts] Email ${email}: multiple password hashes; using row ${canonical.id} as canonical.`,
      );
    }

    const acc = await prisma.account.create({
      data: {
        email,
        passwordHash: canonical.passwordHash,
        emailVerified: group.some((g) => g.emailVerified),
        phone: canonical.phone ?? null,
      },
    });

    await prisma.user.updateMany({
      where: { id: { in: group.map((g) => g.id) } },
      data: {
        accountId: acc.id,
        passwordHash: acc.passwordHash,
        emailVerified: acc.emailVerified,
      },
    });
    groups += 1;
  }

  console.log(
    `[backfill-accounts] Done. Created/linked ${groups} account(s) for ${users.length} user row(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
