'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Lock,
  User,
  Building2,
  Ticket as TicketIcon,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { SUPPORT_CANNED_REPLIES, formatSlaCountdown } from '@/lib/support-ops';
import { cn } from '@/lib/utils';

type PlatformAdmin = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

export default function TicketViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const {
    data: ticket,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ops', 'support-request', id],
    queryFn: () =>
      api
        .get<{ data: any }>(`/platform-admin/support/requests/${id}`, { token: token! })
        .then((r) => r.data),
    enabled: !!token && !!id,
  });

  const { data: admins = [] } = useQuery({
    queryKey: ['platform', 'admins'],
    queryFn: () =>
      api
        .get<{ data: PlatformAdmin[] }>('/platform-admin/admins', { token: token! })
        .then((r) => r?.data ?? []),
    enabled: !!token,
    staleTime: 60_000,
  });

  const replyMutation = useMutation({
    mutationFn: (data: { message: string; isInternal: boolean }) =>
      api.post(`/platform-admin/support/requests/${id}/replies`, data, { token: token! }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['ops', 'support-request', id] });
      queryClient.invalidateQueries({ queryKey: ['ops', 'support-requests'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; priority?: string; assignedToUserId?: string | null }) =>
      api.patch(`/platform-admin/support/requests/${id}`, data, { token: token! }),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['ops', 'support-request', id] });
      const previousTicket = queryClient.getQueryData<any>(['ops', 'support-request', id]);
      if (previousTicket) {
        queryClient.setQueryData(['ops', 'support-request', id], {
          ...previousTicket,
          ...newData,
        });
      }
      return { previousTicket };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(['ops', 'support-request', id], context.previousTicket);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'support-request', id] });
      queryClient.invalidateQueries({ queryKey: ['ops', 'support-requests'] });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading ticket...</div>;
  if (error)
    return (
      <div className="mx-auto max-w-5xl p-8">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-900">
          <h3 className="font-semibold text-red-800">Error loading ticket</h3>
          <p className="mt-1 text-sm">
            {error instanceof Error ? error.message : 'An unknown error occurred.'}
          </p>
        </div>
      </div>
    );
  if (!ticket) return <div className="p-8 text-center text-slate-500">Ticket not found</div>;

  const sla = formatSlaCountdown(ticket.status === 'resolved' ? null : ticket.dueAt);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-md p-2 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5 text-slate-500" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
              {ticket.status}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                ticket.priority === 'high'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {ticket.priority} Priority
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-semibold',
                sla.overdue ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-800',
              )}
            >
              SLA: {sla.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Ticket ID: {ticket.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex justify-between border-b border-slate-200 bg-slate-50 p-4 font-medium text-slate-700">
              <span>Conversation</span>
            </div>
            <div className="max-h-[600px] space-y-6 overflow-y-auto p-6">
              {ticket.messages?.map((msg: any) => (
                <div key={msg.id} className={`flex gap-4 ${msg.isInternal ? 'pl-8' : ''}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      msg.isInternal ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {msg.isInternal ? <Lock className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div
                    className={`flex-1 rounded-2xl p-4 ${
                      msg.isInternal
                        ? 'border border-amber-200 bg-amber-50'
                        : 'border border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        {msg.author?.firstName} {msg.author?.lastName}
                        {msg.isInternal && (
                          <span className="ml-2 text-xs font-medium text-amber-600">
                            Internal Note
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap gap-2">
                {SUPPORT_CANNED_REPLIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setReply(c.body)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply here..."
                className="min-h-[100px] w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-3 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Lock className="h-4 w-4" />
                  Internal Note (hidden from tenant)
                </label>
                <div className="flex items-center gap-2">
                  {ticket.status !== 'resolved' && (
                    <button
                      onClick={() => {
                        if (reply.trim()) {
                          replyMutation.mutate(
                            { message: reply, isInternal },
                            { onSuccess: () => updateMutation.mutate({ status: 'resolved' }) },
                          );
                        } else {
                          updateMutation.mutate({ status: 'resolved' });
                        }
                      }}
                      disabled={replyMutation.isPending || updateMutation.isPending}
                      className="flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {reply.trim() ? 'Reply & Resolve' : 'Mark as Resolved'}
                    </button>
                  )}
                  <button
                    onClick={() => replyMutation.mutate({ message: reply, isInternal })}
                    disabled={!reply.trim() || replyMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {isInternal ? 'Post Internal Note' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-slate-400" /> Organization
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Name</span>
                {ticket.organization?.id ? (
                  <Link
                    href={`/tenants/${ticket.organization.id}`}
                    className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                  >
                    {ticket.organization?.name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="font-medium text-slate-900">{ticket.organization?.name}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plan</span>
                <span className="font-medium capitalize text-slate-900">
                  {ticket.correlation?.plan || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branches</span>
                <span className="font-medium text-slate-900">
                  {ticket.correlation?.branchCount || 0}
                </span>
              </div>
              {ticket.organization?.id ? (
                <Link
                  href={`/support?orgId=${ticket.organization.id}`}
                  className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                >
                  All tickets for this tenant →
                </Link>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <TicketIcon className="h-4 w-4 text-slate-400" /> Actions
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select
                  value={ticket.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                  className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                  className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Assignee</label>
                <select
                  value={ticket.assignedToUserId ?? ticket.assignedTo?.id ?? ''}
                  onChange={(e) =>
                    updateMutation.mutate({
                      assignedToUserId: e.target.value ? e.target.value : null,
                    })
                  }
                  className="w-full rounded-md border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {admins
                    .filter((a) => a.status !== 'disabled')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.firstName || a.lastName
                          ? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
                          : a.email}
                      </option>
                    ))}
                </select>
              </div>
              {ticket.dueAt ? (
                <p className="text-xs text-slate-500">
                  Due {new Date(ticket.dueAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
