'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { SYSTEM_ROLES, type SystemRole } from '@queueplatform/shared';
import { api } from '@/lib/api';
import { tenantQueryKeys } from '@/lib/tenant-query-keys';
import { cn } from '@/lib/utils';

const USERS_PAGE_SIZE = 20;

const ROLE_PRIORITY: Record<string, number> = {
  [SYSTEM_ROLES.OWNER]: 0,
  [SYSTEM_ROLES.ADMIN]: 1,
  [SYSTEM_ROLES.MANAGER]: 2,
  [SYSTEM_ROLES.STAFF]: 3,
  [SYSTEM_ROLES.VIEWER]: 4,
};

export type TenantUserRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { name: string; branchName: string | null }[];
};

type TenantUsersPayload = {
  items: TenantUserRow[];
  skip: number;
  take: number;
  total: number;
};

function formatUserName(user: Pick<TenantUserRow, 'firstName' | 'lastName' | 'email'>): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

function formatRoleLabel(role: { name: string; branchName: string | null }): string {
  const name = role.name.replace(/_/g, ' ');
  return role.branchName ? `${name} · ${role.branchName}` : name;
}

function formatRoles(roles: TenantUserRow['roles']): string {
  if (roles.length === 0) return '—';
  const unique = new Map<string, string>();
  for (const role of roles) {
    unique.set(`${role.name}:${role.branchName ?? ''}`, formatRoleLabel(role));
  }
  return [...unique.values()].join(', ');
}

export function pickPrimaryRole(roles: TenantUserRow['roles']): SystemRole | 'full' {
  if (roles.length === 0) return 'full';
  const sorted = [...roles].sort(
    (a, b) => (ROLE_PRIORITY[a.name] ?? 99) - (ROLE_PRIORITY[b.name] ?? 99),
  );
  const top = sorted[0]?.name;
  if (
    top === SYSTEM_ROLES.OWNER ||
    top === SYSTEM_ROLES.ADMIN ||
    top === SYSTEM_ROLES.MANAGER ||
    top === SYSTEM_ROLES.STAFF ||
    top === SYSTEM_ROLES.VIEWER
  ) {
    return top;
  }
  return 'full';
}

function formatLastLogin(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700';
    case 'pending_verification':
      return 'bg-amber-50 text-amber-700';
    case 'suspended':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function TenantUsersPanel({
  orgId,
  token,
  onImpersonateUser,
}: {
  orgId: string;
  token: string;
  onImpersonateUser: (role: SystemRole | 'full') => void;
}) {
  const [page, setPage] = useState(0);
  const skip = page * USERS_PAGE_SIZE;

  useEffect(() => {
    setPage(0);
  }, [orgId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: tenantQueryKeys.users(orgId, skip, USERS_PAGE_SIZE),
    queryFn: () =>
      api
        .get<{
          data: TenantUsersPayload;
        }>(`/platform-admin/tenants/${orgId}/users?skip=${skip}&take=${USERS_PAGE_SIZE}`, { token })
        .then((r) => r.data),
    enabled: Boolean(token && orgId),
    staleTime: 30_000,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / USERS_PAGE_SIZE)),
    [data?.total],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-lg font-bold text-slate-900">Users</h3>
        <p className="mt-1 text-sm text-slate-500">
          Staff with access to this organization. Impersonate to see the tenant as their role.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : isError ? (
        <p className="p-6 text-sm text-rose-600">Failed to load users.</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="p-6 text-sm text-slate-500">No users in this organization.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role(s)</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Last login</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data!.items.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">{formatUserName(user)}</td>
                    <td className="px-3 py-3">
                      <a href={`mailto:${user.email}`} className="text-indigo-600 hover:underline">
                        {user.email}
                      </a>
                    </td>
                    <td className="px-3 py-3 capitalize text-slate-600">
                      {formatRoles(user.roles)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                          statusBadgeClass(user.status),
                        )}
                      >
                        {user.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatLastLogin(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onImpersonateUser(pickPrimaryRole(user.roles))}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        Impersonate
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data!.total > USERS_PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
              <p className="text-xs text-slate-500">
                Showing {skip + 1}–{Math.min(skip + USERS_PAGE_SIZE, data!.total)} of {data!.total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
