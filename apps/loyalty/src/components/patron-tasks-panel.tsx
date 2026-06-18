'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CrmTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt?: string | null;
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
    <div className="bg-card rounded-xl border p-5">
      <h2 className="mb-3 font-semibold">Patron tasks</h2>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tasks for this patron.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {task.title}{' '}
                <span className="text-muted-foreground">
                  · {task.priority} · {task.status}
                </span>
              </span>
              {task.status !== 'done' && (
                <Button size="sm" variant="outline" onClick={() => complete.mutate(task.id)}>
                  Done
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
