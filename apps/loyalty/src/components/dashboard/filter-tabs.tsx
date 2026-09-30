import { cn } from '@/lib/utils';

export type FilterTab<T extends string = string> = {
  id: T;
  label: string;
};

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === tab.id
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
