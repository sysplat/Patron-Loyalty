'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, ShieldCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@queueplatform/frontend-core';
import { ConfirmDialog } from '@queueplatform/frontend-core';
import { toast } from 'sonner';

type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function AdminsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'admins'],
    queryFn: () =>
      api
        .get<{ data: AdminUser[] }>('/platform-admin/admins', { token: token! })
        .then((r) => r.data),
    enabled: !!token,
    retry: false,
  });

  const admins = useMemo(() => data ?? [], [data]);

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/platform-admin/admins', body, { token: token! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
      setForm({ email: '', firstName: '', lastName: '', password: '' });
      setShowForm(false);
      setFormError('');
      toast.success('Administrator account created successfully');
    },
    onError: (err: any) => {
      setFormError(err.data?.message ?? err.message ?? 'Failed to create admin');
      toast.error('Failed to create administrator');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform-admin/admins/${id}`, { token: token! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'admins'] });
      toast.success('Administrator removed');
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    createMutation.mutate(form);
  }

  function handleDelete(admin: AdminUser) {
    setConfirmDelete(admin);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Admins</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage accounts with full platform operator access. Access is granted automatically to
            members of the internal organization.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setFormError('');
          }}
          className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Platform Administrator</DialogTitle>
            <DialogDescription>
              Create a new account with platform-wide administrative privileges.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">First Name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Parsa"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Samandi"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                <ShieldAlert className="h-3.5 w-3.5" />
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 p-6">
                <div className="h-12 w-12 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : admins.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <ShieldCheck className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No admins found</h3>
            <p className="mt-1 text-xs text-slate-500">
              Get started by creating a new platform operator account.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {admins.map((admin) => {
              const isSelf = admin.id === currentUser?.id;
              const initials =
                `${(admin.firstName || '?')[0]}${(admin.lastName || '')[0] || ''}`.toUpperCase();
              const lastLoginFormatted = admin.lastLoginAt
                ? new Date(admin.lastLoginAt).toLocaleDateString()
                : 'Never';

              return (
                <div
                  key={admin.id}
                  className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-slate-50/50"
                >
                  {/* Avatar */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-base font-bold text-indigo-600 shadow-sm transition-transform group-hover:scale-105">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">
                        {admin.firstName} {admin.lastName}
                      </p>
                      {isSelf && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                          You
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{admin.email}</p>
                  </div>

                  {/* Details */}
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 px-4 sm:flex">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Last Login
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {lastLoginFormatted}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          admin.status === 'active'
                            ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${admin.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {admin.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-2 flex shrink-0 items-center gap-2 border-l border-slate-100 pl-4">
                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(admin)}
                        disabled={deleteMutation.isPending}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
                        title="Remove admin access"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                      onClick={() => router.push(`/admins/${admin.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Admins created here are automatically granted full platform-wide permissions. All sensitive
        actions are logged in the Audit Trail.
      </p>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(val) => !val && setConfirmDelete(null)}
        title="Remove Administrator"
        description={`Are you sure you want to remove admin access for ${confirmDelete?.email}? This action cannot be undone.`}
        confirmText="Remove Access"
        variant="destructive"
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
      />
    </div>
  );
}
