import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const ROW_WIDTHS = ['100%', '88%', '72%', '94%', '66%'];

/** Shared in-card loading placeholder for staff dashboard sections. */
export function LoadingBlock({
  rows = 3,
  label = 'Loading…',
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          style={{ width: ROW_WIDTHS[index % ROW_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}
