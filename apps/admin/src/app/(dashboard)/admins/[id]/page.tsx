'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Calendar, Clock, ChevronLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@queueplatform/frontend-core';

type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function AdminDetailPage() {
  const { id } = useParams();
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  const {
    data: admin,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['platform', 'admins', id],
    queryFn: () =>
      api
        .get<{ data: AdminUser }>(`/platform-admin/admins/${id}`, { token: token! })
        .then((r) => r.data),
    enabled: !!token && !!id,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-1/4 rounded bg-slate-200" />
        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-8" />
      </div>
    );
  }

  if (error || !admin) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Admin not found</h3>
        <p className="mt-1 text-sm text-slate-500">
          The administrator account you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/admins')}>
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/admins')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Administrators
      </button>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-100">
            {admin.firstName?.[0] || admin.email[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {admin.firstName} {admin.lastName}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              {admin.email}
            </p>
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            admin.status === 'active'
              ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border border-slate-200 bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${admin.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
          />
          {admin.status}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-slate-400">
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Account Created</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {new Date(admin.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(admin.createdAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-slate-400">
            <Clock className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Last Activity</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {admin.lastLoginAt
              ? new Date(admin.lastLoginAt).toLocaleDateString(undefined, { dateStyle: 'long' })
              : 'Never'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {admin.lastLoginAt
              ? new Date(admin.lastLoginAt).toLocaleTimeString()
              : 'No login history'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-slate-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Security Status</span>
          </div>
          <p className="text-lg font-bold text-slate-900">Verified Operator</p>
          <p className="mt-1 text-xs font-medium text-emerald-600">Standard RBAC Policies Active</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="mb-2 text-sm font-bold text-slate-900">Platform Access Note</h3>
        <p className="text-sm leading-relaxed text-slate-600">
          This account is a member of the internal organization and has full visibility over the
          Platform Pulse, Tenants, and Support Queue. All administrative actions taken by this user
          are recorded in the global Audit Trail for compliance and security monitoring.
        </p>
      </div>
    </div>
  );
}
