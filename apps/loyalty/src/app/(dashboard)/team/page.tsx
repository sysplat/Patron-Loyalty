'use client';

import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIONS, LOYALTY_STARTER, RESOURCES, SYSTEM_ROLES } from '@queueplatform/shared';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { api } from '@/lib/api';
import { fetchPaginated, unwrapApiData } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import {
  actorMayAssignRoles,
  canActorAssignRole,
  canActorManageUserWithRole,
  formatRoleLabel,
  formatUserDisplayName,
  hasPermission,
} from '@/lib/rbac-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'inactive';

interface RoleRow {
  id: string;
  name: string;
}

interface BranchRow {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  status: string;
  createdAt?: string;
  roleAssignments?: Array<{
    role?: { id?: string; name?: string } | null;
    branch?: { id?: string; name?: string } | null;
  }>;
}

interface SubscriptionUsage {
  usage?: {
    users?: { current: number; limit: number };
  };
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

const ROLE_GUIDE: { role: string; meaning: string }[] = [
  { role: 'Owner', meaning: 'Full control, billing, and deleting staff.' },
  { role: 'Admin', meaning: 'Invite and manage staff; configure the program.' },
  { role: 'Manager', meaning: 'Day-to-day operations; cannot invite teammates.' },
  { role: 'Staff', meaning: 'Counter, customers, and redemptions.' },
  { role: 'Viewer', meaning: 'Read-only access.' },
];

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function memberRoleName(user: TeamMember): string {
  return String(user.roleAssignments?.[0]?.role?.name ?? '').toLowerCase();
}

function memberRoleId(user: TeamMember): string {
  return String(user.roleAssignments?.[0]?.role?.id ?? '');
}

function memberDisplayName(user: TeamMember): string {
  return formatUserDisplayName(user);
}

function roleRequiresBranches(roleName: string | undefined): boolean {
  const n = String(roleName ?? '').toLowerCase();
  return n === SYSTEM_ROLES.MANAGER || n === SYSTEM_ROLES.STAFF || n === SYSTEM_ROLES.VIEWER;
}

/** Meets API password policy (min 8 + upper/lower/digit). */
function generateCompliantPassword(): string {
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const uppers = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!;
  const rest = lowers + uppers + digits;
  const chars = [pick(lowers), pick(uppers), pick(digits)];
  for (let i = 0; i < 11; i++) chars.push(pick(rest));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join('');
}

function memberBranchIds(user: TeamMember): string[] {
  const ids = (user.roleAssignments ?? [])
    .map((a) => a.branch?.id)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

function MemberAvatar({ name }: { name: string }) {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  ];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        colors[idx],
      )}
    >
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  destructive,
  summary,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  destructive?: boolean;
  summary?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close dialog"
        disabled={pending}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md border shadow-xl"
      >
        <CardHeader className="space-y-3 pb-3">
          {destructive ? (
            <div className="bg-destructive/10 text-destructive flex h-11 w-11 items-center justify-center rounded-full">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <CardTitle id={titleId} className="text-lg">
              {title}
            </CardTitle>
            <CardDescription id={descId} className="text-sm leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {summary}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={pending}
              autoFocus
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const currentUserRole = useAuthStore((s) => String(s.user?.role ?? '').toLowerCase());
  const qc = useQueryClient();

  const canAssignRoles = actorMayAssignRoles(currentUserRole);
  const canInvite =
    hasPermission(currentUserRole, RESOURCES.USER, ACTIONS.CREATE) && canAssignRoles;
  const canDeleteUsers = hasPermission(currentUserRole, RESOURCES.USER, ACTIONS.DELETE);
  const canReadBilling = hasPermission(currentUserRole, RESOURCES.BILLING, ACTIONS.READ);

  const [guideOpen, setGuideOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDeferredValue(searchInput.trim());

  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
    password: '',
    branchIds: [] as string[],
  });

  const [roleEdit, setRoleEdit] = useState<{
    id: string;
    name: string;
    email: string;
    roleId: string;
    targetRoleName: string;
    branchIds: string[];
  } | null>(null);
  const [passwordEdit, setPasswordEdit] = useState<{
    id: string;
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<TeamMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);

  const { data: usersPage, isLoading } = useQuery({
    queryKey: ['users', 'team', search],
    queryFn: () => {
      const p = new URLSearchParams({ limit: '100' });
      if (search) p.set('search', search);
      return fetchPaginated<TeamMember>(`/users?${p.toString()}`, token!);
    },
    enabled: !!token,
  });

  const members = usersPage?.data ?? [];

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () =>
      api
        .get<unknown>('/roles', { token: token! })
        .then((payload) => unwrapApiData<RoleRow[]>(payload) ?? []),
    enabled: !!token && canAssignRoles,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', 'team'],
    queryFn: () =>
      api
        .get<unknown>('/branches', { token: token!, showErrorToast: false })
        .then((payload) => {
          const unwrapped = unwrapApiData<BranchRow[] | { data: BranchRow[] }>(payload);
          if (Array.isArray(unwrapped)) return unwrapped;
          if (unwrapped && typeof unwrapped === 'object' && 'data' in unwrapped) {
            return Array.isArray(unwrapped.data) ? unwrapped.data : [];
          }
          return [];
        })
        .catch(() => [] as BranchRow[]),
    enabled: !!token && (canInvite || canAssignRoles),
  });

  const { data: subscription } = useQuery({
    queryKey: ['billing', 'subscription', 'team'],
    queryFn: () =>
      api
        .get<unknown>('/billing/subscription', { token: token!, showErrorToast: false })
        .then((payload) => unwrapApiData<SubscriptionUsage>(payload)),
    enabled: !!token && canReadBilling,
  });

  const assignableRoles = useMemo(() => {
    return roles.filter((r) => canActorAssignRole(currentUserRole, r.name));
  }, [roles, currentUserRole]);

  const selectedInviteRoleName = useMemo(() => {
    return String(roles.find((r) => r.id === inviteForm.roleId)?.name ?? '').toLowerCase();
  }, [roles, inviteForm.roleId]);

  const showBranchPicker = branches.length > 0 && roleRequiresBranches(selectedInviteRoleName);

  const inactiveCount = members.filter((m) => m.status !== 'active').length;
  const activeFromList = members.filter((m) => m.status === 'active').length;
  const seatLimit =
    subscription?.usage?.users?.limit && subscription.usage.users.limit > 0
      ? subscription.usage.users.limit
      : (LOYALTY_STARTER.limits.maxUsers as number);
  /** Prefer live active count so deactivated seats free invites even if billing lags. */
  const seatCurrent = activeFromList;
  const atSeatLimit = seatLimit > 0 && seatCurrent >= seatLimit;

  const selectedEditRoleName = useMemo(() => {
    if (!roleEdit) return '';
    return String(
      roles.find((r) => r.id === roleEdit.roleId)?.name ?? roleEdit.targetRoleName,
    ).toLowerCase();
  }, [roleEdit, roles]);

  const showEditBranchPicker = branches.length > 0 && roleRequiresBranches(selectedEditRoleName);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter === 'active') return m.status === 'active';
      if (statusFilter === 'inactive') return m.status !== 'active';
      return true;
    });
  }, [members, statusFilter]);

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post(
        '/users/invite',
        {
          email: inviteForm.email.trim().toLowerCase(),
          firstName: inviteForm.firstName.trim(),
          lastName: inviteForm.lastName.trim(),
          roleId: inviteForm.roleId,
          password: inviteForm.password,
          branchIds: showBranchPicker ? inviteForm.branchIds : [],
        },
        { token: token! },
      ),
    onSuccess: async () => {
      toast.success('Teammate invited — share the password securely');
      if (inviteForm.password && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(inviteForm.password).catch(() => undefined);
      }
      setInviteForm({
        firstName: '',
        lastName: '',
        email: '',
        roleId: '',
        password: '',
        branchIds: [],
      });
      setInviteOpen(false);
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not invite teammate'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: () => {
      if (!roleEdit) throw new Error('No teammate selected');
      const body: { roleId: string; branchIds?: string[] } = { roleId: roleEdit.roleId };
      if (showEditBranchPicker) {
        body.branchIds = roleEdit.branchIds;
      } else if (
        selectedEditRoleName === SYSTEM_ROLES.OWNER ||
        selectedEditRoleName === SYSTEM_ROLES.ADMIN
      ) {
        body.branchIds = [];
      }
      return api.patch(`/users/${roleEdit.id}`, body, { token: token! });
    },
    onSuccess: async () => {
      toast.success('Role updated');
      setRoleEdit(null);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not update role'),
  });

  const setPasswordMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/users/${passwordEdit!.id}/set-password`,
        { password: passwordEdit!.password },
        { token: token! },
      ),
    onSuccess: async () => {
      if (passwordEdit?.password && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(passwordEdit.password).catch(() => undefined);
      }
      toast.success('Password reset — copied to clipboard. Share it securely.');
      setPasswordEdit(null);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not reset password'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'deactivate' | 'activate' }) =>
      api.post(`/users/${id}/${action}`, {}, { token: token! }),
    onSuccess: async (_data, vars) => {
      toast.success(vars.action === 'deactivate' ? 'Teammate deactivated' : 'Teammate reactivated');
      setConfirmDeactivate(null);
      setConfirmActivate(null);
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`, { token: token! }),
    onSuccess: async () => {
      toast.success('Teammate removed');
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ['users'] });
      await qc.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not delete teammate'),
  });

  function openInvite() {
    const defaultRole =
      assignableRoles.find((r) => r.name.toLowerCase() === SYSTEM_ROLES.STAFF) ??
      assignableRoles[0];
    setInviteForm({
      firstName: '',
      lastName: '',
      email: '',
      roleId: defaultRole?.id ?? '',
      password: generateCompliantPassword(),
      branchIds: [],
    });
    setInviteOpen(true);
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Team</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Invite staff and manage roles for your loyalty workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          {canInvite ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (inviteOpen) setInviteOpen(false);
                else openInvite();
              }}
              disabled={!inviteOpen && atSeatLimit}
            >
              {inviteOpen ? (
                'Close'
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite teammate
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Owners and admins invite teammates. Seat limits come from your plan. Deactivate to
              free a seat without deleting history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {ROLE_GUIDE.map((item) => (
                <li key={item.role} className="space-y-1">
                  <p className="text-foreground font-medium">{item.role}</p>
                  <p className="text-xs leading-relaxed">{item.meaning}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active seats', value: String(seatCurrent) },
          { label: 'Seat limit', value: seatLimit > 0 ? String(seatLimit) : '—' },
          { label: 'Inactive', value: String(inactiveCount) },
          {
            label: 'You',
            value: formatRoleLabel(currentUserRole),
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {atSeatLimit && canInvite ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-amber-950 dark:text-amber-100">
              Staff seat limit reached ({seatCurrent}/{seatLimit}). Deactivate an inactive teammate
              or upgrade your plan to invite more.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {inviteOpen && canInvite ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite teammate</CardTitle>
            <CardDescription>
              Creates an account with a temporary password. Copy it once and share it securely —
              they sign in at the same login page you use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteForm.firstName.trim() || !inviteForm.lastName.trim()) {
                  toast.error('Enter first and last name');
                  return;
                }
                if (!inviteForm.email.trim()) {
                  toast.error('Enter an email');
                  return;
                }
                if (!inviteForm.roleId) {
                  toast.error('Select a role');
                  return;
                }
                if (!inviteForm.password || inviteForm.password.length < 8) {
                  toast.error('Generate a compliant password');
                  return;
                }
                if (showBranchPicker && inviteForm.branchIds.length === 0) {
                  toast.error('Select at least one branch for this role');
                  return;
                }
                inviteMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">First name</Label>
                <Input
                  id="invite-first"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">Last name</Label>
                <Input
                  id="invite-last"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="teammate@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className={selectClassName()}
                  value={inviteForm.roleId}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, roleId: e.target.value, branchIds: [] }))
                  }
                >
                  <option value="">Select role</option>
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatRoleLabel(r.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-password">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-password"
                    value={inviteForm.password}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Generate new password"
                    onClick={() =>
                      setInviteForm((f) => ({ ...f, password: generateCompliantPassword() }))
                    }
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {showBranchPicker ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Branches</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map((b) => {
                      const checked = inviteForm.branchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="border-border flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setInviteForm((f) => ({
                                ...f,
                                branchIds: checked
                                  ? f.branchIds.filter((id) => id !== b.id)
                                  : [...f.branchIds, b.id],
                              }))
                            }
                          />
                          {b.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={inviteMutation.isPending || atSeatLimit}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {inviteMutation.isPending ? 'Inviting…' : 'Create account'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === item.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </CardContent>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center">
            <p className="text-sm font-medium">No teammates in this view</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
              {canInvite
                ? 'Invite your first teammate to share Counter and customer work.'
                : 'Ask an owner or admin if you need someone added.'}
            </p>
            {canInvite && !atSeatLimit ? (
              <Button type="button" size="sm" className="mt-5" onClick={openInvite}>
                Invite teammate
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Teammate</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const roleName = memberRoleName(member);
                  const displayName = memberDisplayName(member);
                  const isSelf = member.id === currentUserId;
                  const canManage =
                    !isSelf && canActorManageUserWithRole(currentUserRole, roleName);
                  const isActive = member.status === 'active';

                  return (
                    <tr
                      key={member.id}
                      className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={displayName} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {displayName}
                              {isSelf ? (
                                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                                  (you)
                                </span>
                              ) : null}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal capitalize">
                          {formatRoleLabel(roleName || 'viewer')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={isActive ? 'default' : 'secondary'}
                          className="font-normal capitalize"
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {canAssignRoles ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setRoleEdit({
                                    id: member.id,
                                    name: displayName,
                                    email: member.email,
                                    roleId: memberRoleId(member),
                                    targetRoleName: roleName,
                                    branchIds: memberBranchIds(member),
                                  })
                                }
                              >
                                Role
                              </Button>
                            ) : null}
                            {hasPermission(currentUserRole, RESOURCES.USER, ACTIONS.UPDATE) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setPasswordEdit({
                                    id: member.id,
                                    name: displayName,
                                    email: member.email,
                                    password: generateCompliantPassword(),
                                  })
                                }
                              >
                                <KeyRound className="mr-1 h-3.5 w-3.5" />
                                Password
                              </Button>
                            ) : null}
                            {isActive ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDeactivate(member)}
                              >
                                <ShieldOff className="mr-1 h-3.5 w-3.5" />
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={atSeatLimit}
                                title={
                                  atSeatLimit
                                    ? 'Staff seat limit reached — free a seat first'
                                    : undefined
                                }
                                onClick={() => setConfirmActivate(member)}
                              >
                                Activate
                              </Button>
                            )}
                            {canDeleteUsers ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setConfirmDelete(member)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground block text-right text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {roleEdit ? (
        <ConfirmActionDialog
          title="Change role"
          description={`Update access for ${roleEdit.name}. They keep the same login; permissions change immediately.`}
          confirmLabel="Save role"
          pendingLabel="Saving…"
          pending={updateRoleMutation.isPending}
          onCancel={() => setRoleEdit(null)}
          onConfirm={() => {
            if (showEditBranchPicker && roleEdit.branchIds.length === 0) {
              toast.error('Select at least one branch for this role');
              return;
            }
            updateRoleMutation.mutate();
          }}
          summary={
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  className={selectClassName()}
                  value={roleEdit.roleId}
                  onChange={(e) =>
                    setRoleEdit((r) =>
                      r ? { ...r, roleId: e.target.value, branchIds: r.branchIds } : r,
                    )
                  }
                >
                  {roles
                    .filter((r) => canActorAssignRole(currentUserRole, r.name))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {formatRoleLabel(r.name)}
                      </option>
                    ))}
                </select>
              </div>
              {showEditBranchPicker ? (
                <div className="space-y-2">
                  <Label>Branches</Label>
                  <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                    {branches.map((b) => {
                      const checked = roleEdit.branchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="border-border flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setRoleEdit((r) =>
                                r
                                  ? {
                                      ...r,
                                      branchIds: checked
                                        ? r.branchIds.filter((id) => id !== b.id)
                                        : [...r.branchIds, b.id],
                                    }
                                  : r,
                              )
                            }
                          />
                          {b.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          }
        />
      ) : null}

      {passwordEdit ? (
        <ConfirmActionDialog
          title="Reset password"
          description={`Set a new temporary password for ${passwordEdit.name}. Their sessions end and they must sign in again.`}
          confirmLabel="Reset password"
          pendingLabel="Saving…"
          pending={setPasswordMutation.isPending}
          onCancel={() => setPasswordEdit(null)}
          onConfirm={() => setPasswordMutation.mutate()}
          summary={
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  value={passwordEdit.password}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setPasswordEdit((p) =>
                      p ? { ...p, password: generateCompliantPassword() } : p,
                    )
                  }
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          }
        />
      ) : null}

      {confirmDeactivate ? (
        <ConfirmActionDialog
          title="Deactivate teammate?"
          description="They lose access immediately. The seat is freed for a new invite. You can reactivate later."
          confirmLabel="Deactivate"
          pendingLabel="Deactivating…"
          pending={toggleStatusMutation.isPending}
          destructive
          onCancel={() => setConfirmDeactivate(null)}
          onConfirm={() =>
            toggleStatusMutation.mutate({ id: confirmDeactivate.id, action: 'deactivate' })
          }
          summary={
            <div className="bg-muted/50 rounded-lg border px-3.5 py-3 text-sm">
              <p className="font-semibold">{memberDisplayName(confirmDeactivate)}</p>
              <p className="text-muted-foreground text-xs">{confirmDeactivate.email}</p>
            </div>
          }
        />
      ) : null}

      {confirmActivate ? (
        <ConfirmActionDialog
          title="Reactivate teammate?"
          description={
            atSeatLimit
              ? 'Staff seat limit reached. Deactivate someone else or upgrade before reactivating.'
              : 'They regain access with their previous role. This uses one staff seat.'
          }
          confirmLabel="Activate"
          pendingLabel="Activating…"
          pending={toggleStatusMutation.isPending}
          onCancel={() => setConfirmActivate(null)}
          onConfirm={() => {
            if (atSeatLimit) {
              toast.error('Staff seat limit reached');
              return;
            }
            toggleStatusMutation.mutate({ id: confirmActivate.id, action: 'activate' });
          }}
          summary={
            <div className="bg-muted/50 rounded-lg border px-3.5 py-3 text-sm">
              <p className="font-semibold">{memberDisplayName(confirmActivate)}</p>
              <p className="text-muted-foreground text-xs">{confirmActivate.email}</p>
            </div>
          }
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmActionDialog
          title="Delete teammate permanently?"
          description="This removes their staff account. Prefer deactivate unless you are sure they should never return."
          confirmLabel="Delete forever"
          pendingLabel="Deleting…"
          pending={deleteMutation.isPending}
          destructive
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          summary={
            <div className="bg-muted/50 rounded-lg border px-3.5 py-3 text-sm">
              <p className="font-semibold">{memberDisplayName(confirmDelete)}</p>
              <p className="text-muted-foreground text-xs">{confirmDelete.email}</p>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
