import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatItem = {
  label: string;
  value: ReactNode;
};

export function StatStrip({
  stats,
  columns = 4,
  className,
}: {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid gap-3', gridClass, className)}>
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
