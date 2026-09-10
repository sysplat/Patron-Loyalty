'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@queueplatform/frontend-core';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type PurgeDryRun = {
  organization: { id: string; name: string; slug: string };
  countsWouldDelete: {
    tickets: number;
    users: number;
    branches: number;
    queues: number;
  };
  note: string;
};

type DeleteOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  onDeleted: () => void;
};

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  onDeleted,
}: DeleteOrganizationDialogProps) {
  const token = useAuthStore((s) => s.accessToken);
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  const dryRunQuery = useQuery({
    queryKey: ['platform-admin', 'purge-dry-run', orgId],
    queryFn: () =>
      api
        .post<{
          data: PurgeDryRun;
        }>('/platform-admin/data/purge-dry-run', { orgId }, { token: token! })
        .then((r) => r.data),
    enabled: open && !!token && !!orgId,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.post('/platform-admin/data/purge-execute', { orgId, confirmation }, { token: token! }),
    onSuccess: () => {
      toast.success(`Organization "${orgName}" permanently deleted`);
      onOpenChange(false);
      onDeleted();
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete organization';
      toast.error(message);
    },
  });

  const counts = dryRunQuery.data?.countsWouldDelete;
  const nameMatches = confirmation === orgName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            Delete organization
          </DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-semibold text-slate-900">{orgName}</span> and
            all related branches, queues, tickets, and users. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {dryRunQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading deletion impact…</p>
          ) : dryRunQuery.isError ? (
            <p className="text-sm text-rose-600">
              Could not load deletion impact. You can still proceed by typing the organization name.
            </p>
          ) : counts ? (
            <ul className="grid grid-cols-2 gap-2 rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-rose-900">
              <li>
                Branches: <span className="font-semibold">{counts.branches}</span>
              </li>
              <li>
                Queues: <span className="font-semibold">{counts.queues}</span>
              </li>
              <li>
                Users: <span className="font-semibold">{counts.users}</span>
              </li>
              <li>
                Tickets: <span className="font-semibold">{counts.tickets}</span>
              </li>
            </ul>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Type <span className="font-mono text-rose-700">{orgName}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              placeholder={orgName}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            disabled={deleteMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={!nameMatches || deleteMutation.isPending}
            className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
