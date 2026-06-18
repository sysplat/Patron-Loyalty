import { Prisma, PrismaClient } from '@prisma/client';

export type AdminTwoFactorMembership = {
  id: string;
  orgId: string;
  email: string;
  adminTwoFactorEnabled: boolean;
  adminTwoFactorSecret: string | null;
  adminTwoFactorBackupHashes: Prisma.JsonValue | null;
};

export type ResolvedAdminTwoFactor = {
  email: string;
  memberships: AdminTwoFactorMembership[];
  enabled: boolean;
  enrollmentPending: boolean;
  secret: string | null;
  backupHashes: Prisma.JsonValue | null;
};

const membershipSelect = {
  id: true,
  orgId: true,
  email: true,
  adminTwoFactorEnabled: true,
  adminTwoFactorSecret: true,
  adminTwoFactorBackupHashes: true,
} as const;

function pickAdminTwoFactorSource(
  memberships: AdminTwoFactorMembership[],
): AdminTwoFactorMembership | null {
  const enabledWithSecret = memberships.find(
    (m) => m.adminTwoFactorEnabled && m.adminTwoFactorSecret,
  );
  if (enabledWithSecret) return enabledWithSecret;

  const enabled = memberships.find((m) => m.adminTwoFactorEnabled);
  if (enabled) return enabled;

  const pending = memberships.find((m) => m.adminTwoFactorSecret && !m.adminTwoFactorEnabled);
  if (pending) return pending;

  return memberships[0] ?? null;
}

/** Admin Dashboard 2FA is account-wide; org membership picks a different User row. */
export async function loadAdminTwoFactorMemberships(
  tx: PrismaClient,
  userId: string,
): Promise<ResolvedAdminTwoFactor | null> {
  const anchor = await tx.user.findUnique({
    where: { id: userId },
    select: { ...membershipSelect, accountId: true },
  });
  if (!anchor) return null;

  const memberships = anchor.accountId
    ? await tx.user.findMany({
        where: { accountId: anchor.accountId },
        select: membershipSelect,
      })
    : await tx.user.findMany({
        where: { email: { equals: anchor.email, mode: 'insensitive' } },
        select: membershipSelect,
      });

  const enabled = memberships.some((m) => m.adminTwoFactorEnabled);
  const source = pickAdminTwoFactorSource(memberships);

  return {
    email: anchor.email,
    memberships,
    enabled,
    enrollmentPending: Boolean(source?.adminTwoFactorSecret && !enabled),
    secret: source?.adminTwoFactorSecret ?? null,
    backupHashes: source?.adminTwoFactorBackupHashes ?? null,
  };
}

export async function syncAdminTwoFactorToMemberships(
  tx: PrismaClient,
  memberships: AdminTwoFactorMembership[],
  data: {
    adminTwoFactorSecret?: string | null;
    adminTwoFactorEnabled?: boolean;
    adminTwoFactorBackupHashes?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  },
): Promise<void> {
  if (memberships.length === 0) return;

  const userIds = memberships.map((m) => m.id);
  const orgIds = [...new Set(memberships.map((m) => m.orgId))];

  for (const orgId of orgIds) {
    await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    await tx.user.updateMany({
      where: { id: { in: userIds }, orgId },
      data,
    });
  }
}
