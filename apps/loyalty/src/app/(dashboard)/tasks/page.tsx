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

interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  customer?: { id: string; name: string } | null;
}

export default function TasksPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'tasks'],
    queryFn: () => loyaltyGet<CrmTask[]>('/loyalty/tasks', token!),
    enabled: !!token,
  });

  const create = useMutation({
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

  const complete = useMutation({
    mutationFn: (id: string) => loyaltyPatch(`/loyalty/tasks/${id}`, token!, { status: 'done' }),
    onSuccess: () => {
      toast.success('Task completed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
    onError: () => toast.error('Could not update task'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>CRM tasks</h1>
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
          <Button onClick={() => create.mutate()} disabled={!title || create.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>
      {isLoading ? (
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
                  <Button size="sm" variant="outline" onClick={() => complete.mutate(task.id)}>
                    Mark done
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {tasks.length === 0 && <p className="text-muted-foreground text-sm">No open tasks.</p>}
        </div>
      )}
    </div>
  );
}
