'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { SYSTEM_ROLES, type SystemRole } from '@queueplatform/shared';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { buildTenantImpersonationLaunchUrl } from '@/lib/impersonation-launch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@queueplatform/frontend-core';
import { toast } from 'sonner';

const ROLE_OPTIONS: { value: SystemRole | 'full'; label: string; hint: string }[] = [
  {
    value: 'full',
    label: 'Full access',
    hint: 'Support mode — bypasses tenant RBAC (default)',
  },
  { value: SYSTEM_ROLES.OWNER, label: 'Owner', hint: 'Org-wide, billing + settings' },
  { value: SYSTEM_ROLES.ADMIN, label: 'Admin', hint: 'Org-wide operations, no billing' },
  { value: SYSTEM_ROLES.MANAGER, label: 'Manager', hint: 'Branch-scoped supervisor' },
  { value: SYSTEM_ROLES.STAFF, label: 'Staff', hint: 'Branch frontline serve console' },
  { value: SYSTEM_ROLES.VIEWER, label: 'Viewer', hint: 'Branch read-only' },
];

const BRANCH_SCOPED: SystemRole[] = [SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.STAFF, SYSTEM_ROLES.VIEWER];

type BranchRow = { id: string; name: string };

export function ImpersonationDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  initialRole = 'full',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  initialRole?: SystemRole | 'full';
}) {
  const token = useAuthStore((s) => s.accessToken);
  const operator = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<SystemRole | 'full'>(initialRole);
  const [branchId, setBranchId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Focus management: focus the first interactive element when dialog opens
  const accessModeRef = useRef<HTMLSelectElement>(null);
  // Track whether the dialog was just opened to trigger initial focus
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Small delay lets the dialog animation settle before moving focus
      const timer = setTimeout(() => {
        accessModeRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Reset state when dialog is closed; apply initialRole when opened
  useEffect(() => {
    if (!open) {
      setMode('full');
      setBranchId('');
      setSubmitting(false);
      return;
    }
    setMode(initialRole);
    setBranchId('');
  }, [open, initialRole]);

  const needsBranch = mode !== 'full' && BRANCH_SCOPED.includes(mode);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['platform-tenant-branches', orgId],
    queryFn: () =>
      api
        .get<{ data: BranchRow[] }>(`/platform-admin/tenants/${orgId}/branches`, { token: token! })
        .then((r) => r.data ?? []),
    enabled: open && !!token && needsBranch,
  });

  const effectiveBranchId = branchId || (branches.length === 1 ? branches[0]?.id : '') || '';

  const canSubmit = !submitting && !(needsBranch && branches.length === 0);

  async function handleStart() {
    if (!token) return;
    setSubmitting(true);
    try {
      const body: { orgId: string; role?: SystemRole; branchId?: string } = { orgId };
      if (mode !== 'full') {
        body.role = mode;
        if (needsBranch && effectiveBranchId) {
          body.branchId = effectiveBranchId;
        }
      }

      const res = await api.post<{
        data: {
          accessToken: string;
          targetOrganization: { id: string; name: string; slug: string; productSku: string };
          simulation?: { role: SystemRole; branchId: string | null; branchName: string | null };
        };
      }>('/platform-admin/impersonation/start', body);

      const accessToken = res?.data?.accessToken ?? '';
      if (!accessToken) {
        toast.error('Impersonation failed — no access token returned');
        return;
      }
      const targetOrganization = res?.data?.targetOrganization;
      const simulation = res?.data?.simulation;
      const role = simulation?.role ?? 'owner';

      if (!operator) {
        toast.error('Session expired — sign in again');
        return;
      }

      onOpenChange(false);
      const launchUrl = buildTenantImpersonationLaunchUrl({
        accessToken,
        orgId,
        orgName,
        role,
        operatorOrgSlug: operator.orgSlug,
        productSku: targetOrganization?.productSku,
        simulatedBranchId: simulation?.branchId,
        simulatedBranchName: simulation?.branchName,
        roleSimulation: Boolean(simulation),
        returnUrl: window.location.origin,
        operator: {
          id: operator.id,
          email: operator.email,
          firstName: operator.firstName,
          lastName: operator.lastName,
        },
      });
      window.open(launchUrl, '_blank');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Impersonation failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentRoleHint = ROLE_OPTIONS.find((o) => o.value === mode)?.hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        aria-labelledby="impersonation-dialog-title"
        aria-describedby="impersonation-dialog-description"
      >
        <DialogHeader>
          <DialogTitle id="impersonation-dialog-title">Impersonate {orgName}</DialogTitle>
          <DialogDescription id="impersonation-dialog-description">
            Open the tenant dashboard without a separate login. Choose a role to test RBAC, or full
            access for support.
          </DialogDescription>
        </DialogHeader>

        <div
          role="note"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600"
        >
          <p className="font-semibold text-slate-800">Tenant view summary</p>
          <p className="mt-1">
            You will land in <span className="font-medium">{orgName}</span> with the selected role.
            Serve consoles, queues, and settings reflect that tenant — not platform admin. End
            impersonation from the banner in the tenant app.
          </p>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="impersonation-mode" className="text-sm font-medium text-slate-700">
              Access mode
            </label>
            <select
              id="impersonation-mode"
              ref={accessModeRef}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as SystemRole | 'full');
                setBranchId('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-describedby="impersonation-mode-hint"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p id="impersonation-mode-hint" className="text-xs text-slate-500">
              {currentRoleHint}
            </p>
          </div>

          {needsBranch && (
            <div className="space-y-2">
              <label htmlFor="impersonation-branch" className="text-sm font-medium text-slate-700">
                Branch
              </label>
              {branchesLoading ? (
                <p className="text-xs text-slate-500" aria-live="polite">
                  Loading branches…
                </p>
              ) : branches.length === 0 ? (
                <p className="text-xs text-amber-700" role="alert">
                  No branches in this org — create one before simulating branch roles.
                </p>
              ) : (
                <select
                  id="impersonation-branch"
                  value={effectiveBranchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {branches.length > 1 && <option value="">First branch (auto)</option>}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleStart()}
            aria-disabled={!canSubmit}
            aria-busy={submitting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Open tenant dashboard'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
