import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10' : 'py-16',
        className,
      )}
    >
      <div
        className={cn(
          'bg-primary/5 text-primary mb-5 flex items-center justify-center rounded-full',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <Icon className={compact ? 'h-6 w-6' : 'h-8 w-8'} aria-hidden />
      </div>
      <p className={cn('font-medium', compact ? 'text-base' : 'text-lg')}>{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-[320px] text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
