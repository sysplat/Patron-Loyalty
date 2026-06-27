'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type CrmTab = 'tasks' | 'tickets' | 'opportunities';

interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  customer?: { id: string; name: string } | null;
}

interface SupportTicket {
  id: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  customer?: { id: string; name: string } | null;
}

interface SalesOpportunity {
  id: string;
  title: string;
  stage: string;
  valueCents: number;
  customer?: { id: string; name: string } | null;
}

export default function TasksPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [tab, setTab] = useState<CrmTab>('tasks');
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCustomerId, setTicketCustomerId] = useState('');
  const [oppTitle, setOppTitle] = useState('');
  const [oppCustomerId, setOppCustomerId] = useState('');
  const [oppValue, setOppValue] = useState('');

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['loyalty', 'tasks'],
    queryFn: () => loyaltyGet<CrmTask[]>('/loyalty/tasks', token!),
    enabled: !!token && tab === 'tasks',
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['loyalty', 'crm', 'tickets'],
    queryFn: () => loyaltyGet<SupportTicket[]>('/loyalty/crm/support-tickets', token!),
    enabled: !!token && tab === 'tickets',
  });

  const { data: opportunities = [], isLoading: oppsLoading } = useQuery({
    queryKey: ['loyalty', 'crm', 'opportunities'],
    queryFn: () => loyaltyGet<SalesOpportunity[]>('/loyalty/crm/sales-opportunities', token!),
    enabled: !!token && tab === 'opportunities',
  });

  const createTask = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/tasks', token!, {
        title,
        customerId: customerId || undefined,
        status: 'open',
        priority: 'medium',
      }),
    onSuccess: () => {
      toast.success('Task created');
      setTitle('');
      setCustomerId('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
    onError: () => toast.error('Could not create task'),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => loyaltyPatch(`/loyalty/tasks/${id}`, token!, { status: 'done' }),
    onSuccess: () => {
      toast.success('Task completed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
    onError: () => toast.error('Could not update task'),
  });

  const createTicket = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/crm/support-tickets', token!, {
        subject: ticketSubject,
        customerId: ticketCustomerId,
        priority: 'normal',
      }),
    onSuccess: () => {
      toast.success('Support ticket created');
      setTicketSubject('');
      setTicketCustomerId('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'tickets'] });
    },
    onError: () => toast.error('Could not create ticket'),
  });

  const resolveTicket = useMutation({
    mutationFn: (id: string) =>
      loyaltyPatch(`/loyalty/crm/support-tickets/${id}`, token!, { status: 'resolved' }),
    onSuccess: () => {
      toast.success('Ticket resolved');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'tickets'] });
    },
    onError: () => toast.error('Could not update ticket'),
  });

  const createOpportunity = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/crm/sales-opportunities', token!, {
        title: oppTitle,
        customerId: oppCustomerId,
        valueCents: oppValue ? Math.round(Number(oppValue) * 100) : 0,
        stage: 'lead',
      }),
    onSuccess: () => {
      toast.success('Opportunity created');
      setOppTitle('');
      setOppCustomerId('');
      setOppValue('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'opportunities'] });
    },
    onError: () => toast.error('Could not create opportunity'),
  });

  const advanceOpportunity = useMutation({
    mutationFn: (id: string) =>
      loyaltyPatch(`/loyalty/crm/sales-opportunities/${id}`, token!, { stage: 'qualified' }),
    onSuccess: () => {
      toast.success('Opportunity updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'opportunities'] });
    },
    onError: () => toast.error('Could not update opportunity'),
  });

  const tabClass = (t: CrmTab) =>
    `rounded-md px-3 py-1.5 text-sm ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>CRM hub</h1>
        <p className="text-muted-foreground text-sm">Tasks, support tickets, and sales pipeline.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass('tasks')} onClick={() => setTab('tasks')}>
          Tasks
        </button>
        <button type="button" className={tabClass('tickets')} onClick={() => setTab('tickets')}>
          Support tickets
        </button>
        <button
          type="button"
          className={tabClass('opportunities')}
          onClick={() => setTab('opportunities')}
        >
          Sales opportunities
        </button>
      </div>

      {tab === 'tasks' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New task</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Patron ID (optional)"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={() => createTask.mutate()} disabled={!title || createTask.isPending}>
                Create
              </Button>
            </CardContent>
          </Card>
          {tasksLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {task.customer?.name ?? 'No patron'} · {task.priority} · {task.status}
                      </p>
                    </div>
                    {task.status !== 'done' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeTask.mutate(task.id)}
                      >
                        Mark done
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {tasks.length === 0 && (
                <p className="text-muted-foreground text-sm">No open tasks.</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'tickets' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New support ticket</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                placeholder="Subject"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Patron ID"
                value={ticketCustomerId}
                onChange={(e) => setTicketCustomerId(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={() => createTicket.mutate()}
                disabled={!ticketSubject || !ticketCustomerId || createTicket.isPending}
              >
                Create
              </Button>
            </CardContent>
          </Card>
          {ticketsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-muted-foreground text-sm">
                        {ticket.customer?.name ?? 'Unknown'} · {ticket.priority} · {ticket.status}
                      </p>
                    </div>
                    {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveTicket.mutate(ticket.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {tickets.length === 0 && (
                <p className="text-muted-foreground text-sm">No support tickets.</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'opportunities' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New sales opportunity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                placeholder="Title"
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Patron ID"
                value={oppCustomerId}
                onChange={(e) => setOppCustomerId(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="Value ($)"
                value={oppValue}
                onChange={(e) => setOppValue(e.target.value)}
                className="max-w-[100px]"
              />
              <Button
                onClick={() => createOpportunity.mutate()}
                disabled={!oppTitle || !oppCustomerId || createOpportunity.isPending}
              >
                Create
              </Button>
            </CardContent>
          </Card>
          {oppsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <Card key={opp.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{opp.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {opp.customer?.name ?? 'Unknown'} · {opp.stage} · $
                        {(opp.valueCents / 100).toFixed(2)}
                      </p>
                    </div>
                    {opp.stage === 'lead' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advanceOpportunity.mutate(opp.id)}
                      >
                        Qualify
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {opportunities.length === 0 && (
                <p className="text-muted-foreground text-sm">No sales opportunities.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
