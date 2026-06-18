import { cn } from './cn';
import { QlessqBrand } from './qlessq-brand';

type PatronPoweredByProps = {
  className?: string;
  /** `inline` — single row; `stacked` — label above mark on narrow headers */
  layout?: 'inline' | 'stacked';
  compact?: boolean;
};

/** Platform attribution shown alongside tenant branding on patron surfaces. */
export function PatronPoweredBy({
  className,
  layout = 'inline',
  compact = false,
}: PatronPoweredByProps) {
  const markSize = compact ? 36 : 44;
  const wordmarkHeight = compact ? 24 : 28;

  const brand = (
    <QlessqBrand
      href={null}
      markSize={markSize}
      wordmarkHeight={wordmarkHeight}
      showWordmark
      className="opacity-90"
      markClassName="opacity-95"
      wordmarkClassName="opacity-80"
    />
  );

  const label = (
    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.14em]">
      Powered by
    </span>
  );

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col items-end gap-0.5', className)}>
        {label}
        {brand}
      </div>
    );
  }

  return (
    <div
      className={cn('border-border/60 flex items-center gap-2 border-l pl-2.5', className)}
      aria-label="Powered by QlessQ"
    >
      {label}
      {brand}
    </div>
  );
}
