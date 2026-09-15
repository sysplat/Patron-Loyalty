'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface CrmTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string | null;
}

function priorityBadge(priority: string) {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'urgent') {
    return (
      <Badge variant="destructive" className="font-normal capitalize">
        {priority}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-normal capitalize">
      {priority}
    </Badge>
  );
}

export function PatronTasksPanel({ customerId }: { customerId: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'tasks', customerId],
    queryFn: () => loyaltyGet<CrmTask[]>(`/loyalty/tasks/customer/${customerId}`, token!),
    enabled: !!token && !!customerId,
  });

  const complete = useMutation({
    mutationFn: (id: string) => loyaltyPatch(`/loyalty/tasks/${id}`, token!, { status: 'done' }),
    onSuccess: () => {
      toast.success('Task completed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks', customerId] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'tasks'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4" />
              Tasks
            </CardTitle>
            <CardDescription>Follow-ups tied to this customer</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 shrink-0" asChild>
            <Link href="/tasks">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No open tasks for this customer.</p>
        ) : (
          <ul className="divide-border/70 divide-y rounded-lg border">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-snug">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {priorityBadge(task.priority)}
                    <Badge variant="secondary" className="font-normal capitalize">
                      {task.status}
                    </Badge>
                    {task.dueAt ? (
                      <span className="text-muted-foreground text-xs">
                        Due{' '}
                        {new Date(task.dueAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
                {task.status !== 'done' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => complete.mutate(task.id)}
                    disabled={complete.isPending}
                  >
                    Done
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
