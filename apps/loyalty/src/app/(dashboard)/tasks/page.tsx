'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost, fetchPaginated } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp, Plus } from 'lucide-react';

type WorkTab = 'tasks' | 'tickets' | 'opportunities';

interface CustomerListItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: string | null;
  customer?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
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

const TABS: { id: WorkTab; label: string; createLabel: string }[] = [
  { id: 'tasks', label: 'Follow-ups', createLabel: 'New follow-up' },
  { id: 'tickets', label: 'Support', createLabel: 'Log issue' },
  { id: 'opportunities', label: 'Pipeline', createLabel: 'Add deal' },
];

const STAGE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'won'] as const;
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

function nextStage(stage: string): string | null {
  const i = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1]!;
}

function dueMeta(
  dueAt?: string | null,
): { label: string; tone: 'overdue' | 'soon' | 'normal' } | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff < 0) return { label: `Overdue · ${date}`, tone: 'overdue' };
  if (diff === 0) return { label: 'Today', tone: 'soon' };
  if (diff === 1) return { label: 'Tomorrow', tone: 'soon' };
  return { label: date, tone: 'normal' };
}

function dueSortKey(dueAt?: string | null): number {
  if (!dueAt) return Number.POSITIVE_INFINITY;
  return new Date(dueAt).getTime();
}

function PatronPicker({
  id,
  selected,
  onSelect,
  onClear,
}: {
  id: string;
  selected: CustomerListItem | null;
  onSelect: (c: CustomerListItem) => void;
  onClear: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());

  const { data: results } = useQuery({
    queryKey: ['customers', 'followups-picker', deferred],
    queryFn: () =>
      fetchPaginated<CustomerListItem>(
        `/customers?search=${encodeURIComponent(deferred)}&limit=8`,
        token!,
      ),
    enabled: !!token && deferred.length >= 2 && !selected,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {[selected.email, selected.phone].filter(Boolean).join(' · ') || 'Selected patron'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, or phone"
        autoComplete="off"
      />
      {deferred.length >= 2 && (results?.data.length ?? 0) > 0 ? (
        <ul className="border-border max-h-44 overflow-auto rounded-md border text-sm shadow-sm">
          {results!.data.map((c) => (
            <li key={c.id} className="border-border/60 border-b last:border-0">
              <button
                type="button"
                className="hover:bg-muted/60 w-full px-3 py-2.5 text-left"
                onClick={() => {
                  onSelect(c);
                  setSearch('');
                }}
              >
                <span className="block font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[c.email, c.phone].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {deferred.length >= 2 && (results?.data.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">
          No match.{' '}
          <Link
            href="/patrons"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Open Customers
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardContent className="px-6 py-12 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
          {body}
        </p>
        <Button type="button" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [tab, setTab] = useState<WorkTab>('tasks');
  const [guideOpen, setGuideOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPatron, setTaskPatron] = useState<CustomerListItem | null>(null);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(
    'normal',
  );
  const [ticketPatron, setTicketPatron] = useState<CustomerListItem | null>(null);

  const [oppTitle, setOppTitle] = useState('');
  const [oppValue, setOppValue] = useState('');
  const [oppNotes, setOppNotes] = useState('');
  const [oppPatron, setOppPatron] = useState<CustomerListItem | null>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['loyalty', 'tasks'],
    queryFn: () => loyaltyGet<CrmTask[]>('/loyalty/tasks', token!),
    enabled: !!token,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['loyalty', 'crm', 'tickets'],
    queryFn: () => loyaltyGet<SupportTicket[]>('/loyalty/crm/support-tickets', token!),
    enabled: !!token,
  });

  const { data: opportunities = [], isLoading: oppsLoading } = useQuery({
    queryKey: ['loyalty', 'crm', 'opportunities'],
    queryFn: () => loyaltyGet<SalesOpportunity[]>('/loyalty/crm/sales-opportunities', token!),
    enabled: !!token,
  });

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => dueSortKey(a.dueAt) - dueSortKey(b.dueAt)),
    [tasks],
  );

  const openTickets = useMemo(
    () => tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed'),
    [tickets],
  );

  const openOpps = useMemo(
    () => opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost'),
    [opportunities],
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => dueMeta(t.dueAt)?.tone === 'overdue').length,
    [tasks],
  );

  const stats = [
    { label: 'Open follow-ups', value: tasks.length },
    { label: 'Overdue', value: overdueCount },
    { label: 'Open support', value: openTickets.length },
    { label: 'Active deals', value: openOpps.length },
  ];

  const activeTab = TABS.find((t) => t.id === tab)!;

  const createTask = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/tasks', token!, {
        title: taskTitle.trim(),
        customerId: taskPatron!.id,
        description: taskNotes.trim() || null,
        dueAt: taskDue ? new Date(`${taskDue}T12:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success('Follow-up saved');
      setTaskTitle('');
      setTaskNotes('');
      setTaskDue('');
      setTaskPatron(null);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
    onError: () => toast.error('Could not save follow-up'),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => loyaltyPatch(`/loyalty/tasks/${id}`, token!, { status: 'done' }),
    onSuccess: () => {
      toast.success('Completed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
    onError: () => toast.error('Could not update follow-up'),
  });

  const createTicket = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/crm/support-tickets', token!, {
        subject: ticketSubject.trim(),
        customerId: ticketPatron!.id,
        description: ticketNotes.trim() || null,
        priority: ticketPriority,
      }),
    onSuccess: () => {
      toast.success('Issue logged');
      setTicketSubject('');
      setTicketNotes('');
      setTicketPriority('normal');
      setTicketPatron(null);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'tickets'] });
    },
    onError: () => toast.error('Could not log issue'),
  });

  const resolveTicket = useMutation({
    mutationFn: (id: string) =>
      loyaltyPatch(`/loyalty/crm/support-tickets/${id}`, token!, { status: 'resolved' }),
    onSuccess: () => {
      toast.success('Resolved');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'tickets'] });
    },
    onError: () => toast.error('Could not resolve issue'),
  });

  const createOpportunity = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/crm/sales-opportunities', token!, {
        title: oppTitle.trim(),
        customerId: oppPatron!.id,
        valueCents: oppValue ? Math.round(Number(oppValue) * 100) : 0,
        stage: 'lead',
        notes: oppNotes.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Deal added');
      setOppTitle('');
      setOppValue('');
      setOppNotes('');
      setOppPatron(null);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'opportunities'] });
    },
    onError: () => toast.error('Could not add deal'),
  });

  const advanceOpportunity = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      loyaltyPatch(`/loyalty/crm/sales-opportunities/${id}`, token!, { stage }),
    onSuccess: () => {
      toast.success('Stage updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'crm', 'opportunities'] });
    },
    onError: () => toast.error('Could not update stage'),
  });

  const selectClassName =
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Follow-ups</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Staff work tied to patrons — follow-ups, support, and pipeline.
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
          <Button type="button" size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {createOpen ? 'Close' : activeTab.createLabel}
          </Button>
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Choose the list that matches the work. Every item must be linked to a patron.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-3">
              <li className="space-y-1">
                <p className="text-foreground font-medium">Follow-ups</p>
                <p className="text-xs leading-relaxed">
                  Internal to-dos: call back, remind about a reward, check in after a visit.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Support</p>
                <p className="text-xs leading-relaxed">
                  Patron-reported problems: missing points, billing questions, service issues.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Pipeline</p>
                <p className="text-xs leading-relaxed">
                  Active sales: memberships, packages, or upsells you are working.
                </p>
              </li>
            </ol>
            <p className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
              Prefer creating follow-ups from a{' '}
              <Link
                href="/patrons"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                customer profile
              </Link>{' '}
              when you already have the patron open. Use Counter for purchases and points — this
              page is for relationship work only.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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

      {createOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{activeTab.createLabel}</CardTitle>
            <CardDescription>
              Search for the patron by name, email, or phone — then add the work item.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (tab === 'tasks') {
                  if (!taskPatron) {
                    toast.error('Select a patron');
                    return;
                  }
                  if (!taskTitle.trim()) {
                    toast.error('Add a follow-up title');
                    return;
                  }
                  createTask.mutate();
                  return;
                }
                if (tab === 'tickets') {
                  if (!ticketPatron) {
                    toast.error('Select a patron');
                    return;
                  }
                  if (!ticketSubject.trim()) {
                    toast.error('Add a subject');
                    return;
                  }
                  createTicket.mutate();
                  return;
                }
                if (!oppPatron) {
                  toast.error('Select a patron');
                  return;
                }
                if (!oppTitle.trim()) {
                  toast.error('Add a deal name');
                  return;
                }
                createOpportunity.mutate();
              }}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="work-patron">Patron</Label>
                    {tab === 'tasks' ? (
                      <PatronPicker
                        id="work-patron"
                        selected={taskPatron}
                        onSelect={setTaskPatron}
                        onClear={() => setTaskPatron(null)}
                      />
                    ) : tab === 'tickets' ? (
                      <PatronPicker
                        id="work-patron"
                        selected={ticketPatron}
                        onSelect={setTicketPatron}
                        onClear={() => setTicketPatron(null)}
                      />
                    ) : (
                      <PatronPicker
                        id="work-patron"
                        selected={oppPatron}
                        onSelect={setOppPatron}
                        onClear={() => setOppPatron(null)}
                      />
                    )}
                  </div>

                  {tab === 'tasks' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="task-title">Action</Label>
                        <Input
                          id="task-title"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="Call about unused birthday reward"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task-due">Due date</Label>
                        <Input
                          id="task-due"
                          type="date"
                          value={taskDue}
                          onChange={(e) => setTaskDue(e.target.value)}
                        />
                      </div>
                    </>
                  ) : null}

                  {tab === 'tickets' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="ticket-subject">Subject</Label>
                        <Input
                          id="ticket-subject"
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder="Points missing from Counter sale"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ticket-priority">Priority</Label>
                        <select
                          id="ticket-priority"
                          value={ticketPriority}
                          onChange={(e) =>
                            setTicketPriority(e.target.value as typeof ticketPriority)
                          }
                          className={selectClassName}
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </>
                  ) : null}

                  {tab === 'opportunities' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="opp-title">Deal</Label>
                        <Input
                          id="opp-title"
                          value={oppTitle}
                          onChange={(e) => setOppTitle(e.target.value)}
                          placeholder="Annual membership"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="opp-value">Estimated value (USD)</Label>
                        <Input
                          id="opp-value"
                          type="number"
                          min={0}
                          step="0.01"
                          value={oppValue}
                          onChange={(e) => setOppValue(e.target.value)}
                          placeholder="0.00"
                          className="max-w-[200px]"
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="work-notes">
                    Notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <textarea
                    id="work-notes"
                    rows={8}
                    value={tab === 'tasks' ? taskNotes : tab === 'tickets' ? ticketNotes : oppNotes}
                    onChange={(e) => {
                      if (tab === 'tasks') setTaskNotes(e.target.value);
                      else if (tab === 'tickets') setTicketNotes(e.target.value);
                      else setOppNotes(e.target.value);
                    }}
                    placeholder={
                      tab === 'tasks'
                        ? 'Anything the next staff member should know…'
                        : tab === 'tickets'
                          ? 'What the patron reported, amounts, dates…'
                          : 'Discovery notes, next meeting, decision-makers…'
                    }
                    className="border-input bg-background focus-visible:ring-ring min-h-[180px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  type="submit"
                  disabled={
                    createTask.isPending || createTicket.isPending || createOpportunity.isPending
                  }
                >
                  {createTask.isPending || createTicket.isPending || createOpportunity.isPending
                    ? 'Saving…'
                    : 'Save'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => {
            const count =
              item.id === 'tasks'
                ? tasks.length
                : item.id === 'tickets'
                  ? openTickets.length
                  : openOpps.length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setCreateOpen(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === item.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
                <span className="tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          {tab === 'tasks'
            ? 'Sorted by due date'
            : tab === 'tickets'
              ? 'Open and recent issues'
              : 'Open pipeline stages'}
        </p>
      </div>

      {tab === 'tasks' ? (
        tasksLoading ? (
          <ListSkeleton />
        ) : sortedTasks.length === 0 ? (
          <EmptyState
            title="No open follow-ups"
            body="Create a follow-up when a patron needs a call-back, reminder, or check-in. You can also add them from a customer profile."
            actionLabel="New follow-up"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Patron</th>
                    <th className="px-4 py-2.5 font-medium">Due</th>
                    <th className="px-4 py-2.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const due = dueMeta(task.dueAt);
                    return (
                      <tr
                        key={task.id}
                        className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                      >
                        <td className="max-w-[280px] px-4 py-3 align-top">
                          <p className="font-medium leading-snug">{task.title}</p>
                          {task.description ? (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                              {task.description}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {task.customer ? (
                            <Link
                              href={`/patrons/${task.customer.id}`}
                              className="text-foreground font-medium underline-offset-2 hover:underline"
                            >
                              {task.customer.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          {due ? (
                            <span
                              className={cn(
                                'text-xs font-medium',
                                due.tone === 'overdue' && 'text-amber-800 dark:text-amber-300',
                                due.tone === 'soon' && 'text-foreground',
                                due.tone === 'normal' && 'text-muted-foreground',
                              )}
                            >
                              {due.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeTask.mutate(task.id)}
                            disabled={completeTask.isPending}
                          >
                            Done
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === 'tickets' ? (
        ticketsLoading ? (
          <ListSkeleton />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No support issues"
            body="Log an issue when a patron reports a problem. Routine reminders belong under Follow-ups."
            actionLabel="Log issue"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Patron</th>
                    <th className="px-4 py-2.5 font-medium">Priority</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                    >
                      <td className="max-w-[280px] px-4 py-3 align-top">
                        <p className="font-medium leading-snug">{ticket.subject}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {ticket.customer ? (
                          <Link
                            href={`/patrons/${ticket.customer.id}`}
                            className="text-foreground font-medium underline-offset-2 hover:underline"
                          >
                            {ticket.customer.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className="font-normal capitalize">
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="secondary" className="font-normal capitalize">
                          {ticket.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveTicket.mutate(ticket.id)}
                            disabled={resolveTicket.isPending}
                          >
                            Resolve
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === 'opportunities' ? (
        oppsLoading ? (
          <ListSkeleton />
        ) : opportunities.length === 0 ? (
          <EmptyState
            title="No deals in pipeline"
            body="Track memberships, packages, and upsells here. Keep call-backs under Follow-ups."
            actionLabel="Add deal"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Deal</th>
                    <th className="px-4 py-2.5 font-medium">Patron</th>
                    <th className="px-4 py-2.5 font-medium">Stage</th>
                    <th className="px-4 py-2.5 font-medium">Value</th>
                    <th className="px-4 py-2.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp) => {
                    const advanceTo = nextStage(opp.stage);
                    return (
                      <tr
                        key={opp.id}
                        className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                      >
                        <td className="max-w-[240px] px-4 py-3 align-top">
                          <p className="font-medium leading-snug">{opp.title}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {opp.customer ? (
                            <Link
                              href={`/patrons/${opp.customer.id}`}
                              className="text-foreground font-medium underline-offset-2 hover:underline"
                            >
                              {opp.customer.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant="secondary" className="font-normal">
                            {STAGE_LABELS[opp.stage] ?? opp.stage}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums">
                          $
                          {(opp.valueCents / 100).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          {advanceTo ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                advanceOpportunity.mutate({ id: opp.id, stage: advanceTo })
                              }
                              disabled={advanceOpportunity.isPending}
                            >
                              → {STAGE_LABELS[advanceTo]}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}
    </div>
  );
}
