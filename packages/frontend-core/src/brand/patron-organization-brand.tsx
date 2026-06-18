import { cn } from './cn';
import { QlessqBrand } from './qlessq-brand';
import { PatronPoweredBy } from './patron-powered-by';

export type PatronOrganizationBrandProps = {
  organization?: { name: string; logoUrl?: string | null } | null;
  branchName?: string | null;
  subtitle?: string | null;
  /**
   * `hero` — primary kiosk/track/book intro with co-brand footer.
   * `header` — sticky nav row (org + powered by).
   * `content` — step title only (logo lives in header / hero above).
   */
  variant?: 'hero' | 'header' | 'content';
  /** On white cards (e.g. visit track) — softer logo well without extra shadow card */
  tone?: 'default' | 'embedded';
  className?: string;
  markSize?: number;
  /** When false, hide platform attribution (rare; default true for custom logos) */
  showPoweredBy?: boolean;
};

function OrgLogoFrame({
  src,
  alt,
  className,
  maxHeight,
}: {
  src: string;
  alt: string;
  className?: string;
  maxHeight: number;
}) {
  return (
    <div
      className={cn(
        'bg-background flex items-center justify-center rounded-xl border border-black/5 p-3 shadow-sm dark:border-white/10',
        className,
      )}
    >
      <img src={src} alt={alt} className="w-auto max-w-full object-contain" style={{ maxHeight }} />
    </div>
  );
}

export function PatronOrganizationBrand({
  organization,
  branchName,
  subtitle,
  variant = 'hero',
  tone = 'default',
  className,
  markSize = 48,
  showPoweredBy = true,
}: PatronOrganizationBrandProps) {
  const name = organization?.name?.trim();
  const logo = organization?.logoUrl?.trim();
  const hasCustomLogo = Boolean(logo);
  const showPlatform = showPoweredBy && hasCustomLogo;

  if (variant === 'content') {
    return (
      <div className={cn('space-y-1 text-center', className)}>
        {branchName ? (
          <p className="text-foreground text-lg font-semibold tracking-tight">{branchName}</p>
        ) : name ? (
          <p className="text-foreground text-lg font-semibold tracking-tight">{name}</p>
        ) : null}
        {subtitle ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
    );
  }

  if (hasCustomLogo) {
    const logoAlt = name ? `${name} logo` : 'Organization logo';
    const logoMaxH = variant === 'header' ? 32 : Math.min(markSize, 56);

    if (variant === 'header') {
      return (
        <div className={cn('flex w-full min-w-0 items-center justify-between gap-3', className)}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <OrgLogoFrame
              src={logo!}
              alt={logoAlt}
              className="h-11 w-11 shrink-0 rounded-lg p-1.5"
              maxHeight={logoMaxH}
            />
            <div className="min-w-0 text-left">
              {name ? (
                <p className="text-foreground truncate text-sm font-semibold leading-tight">
                  {name}
                </p>
              ) : null}
              {branchName ? (
                <p className="text-muted-foreground truncate text-xs">{branchName}</p>
              ) : null}
            </div>
          </div>
          {showPlatform ? (
            <>
              <PatronPoweredBy className="hidden shrink-0 sm:flex" compact />
              <PatronPoweredBy className="shrink-0 sm:hidden" compact layout="stacked" />
            </>
          ) : null}
        </div>
      );
    }

    const heroLogo = (
      <OrgLogoFrame
        src={logo!}
        alt={logoAlt}
        className={cn(
          'w-full max-w-xs px-4 py-4',
          tone === 'embedded' && 'border-none bg-transparent shadow-none',
        )}
        maxHeight={logoMaxH}
      />
    );

    const heroBody = (
      <>
        {heroLogo}
        {name ? (
          <p className="text-foreground text-center text-lg font-semibold tracking-tight">{name}</p>
        ) : null}
        {branchName ? (
          <p className="text-muted-foreground text-center text-sm">{branchName}</p>
        ) : null}
        {subtitle ? (
          <p className="text-muted-foreground max-w-sm text-center text-sm leading-relaxed">
            {subtitle}
          </p>
        ) : null}
        {showPlatform ? <PatronPoweredBy className="justify-center pt-1" /> : null}
      </>
    );

    if (tone === 'embedded') {
      return <div className={cn('flex flex-col items-center gap-3', className)}>{heroBody}</div>;
    }

    return (
      <div className={cn('w-full space-y-3', className)}>
        <div className="bg-card/80 border-border/60 flex flex-col items-center gap-3 rounded-2xl border px-5 py-5 shadow-sm backdrop-blur-sm">
          {heroBody}
        </div>
      </div>
    );
  }

  if (name) {
    if (variant === 'header') {
      return (
        <div className={cn('flex w-full min-w-0 items-center justify-between gap-3', className)}>
          <div className="min-w-0 text-left">
            <p className="text-foreground truncate text-sm font-semibold">{name}</p>
            {branchName ? (
              <p className="text-muted-foreground truncate text-xs">{branchName}</p>
            ) : null}
          </div>
          {showPoweredBy ? <PatronPoweredBy className="shrink-0" compact layout="stacked" /> : null}
        </div>
      );
    }

    return (
      <div className={cn('space-y-2 text-center', className)}>
        <p className="text-foreground text-2xl font-bold tracking-tight">{name}</p>
        {branchName ? <p className="text-muted-foreground text-sm">{branchName}</p> : null}
        {subtitle ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>
        ) : null}
        {showPoweredBy ? <PatronPoweredBy className="justify-center pt-1" /> : null}
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={cn('flex w-full justify-center', className)}>
        <QlessqBrand href={null} markSize={52} wordmarkHeight={32} showWordmark priority />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <QlessqBrand
        href={null}
        markSize={markSize}
        wordmarkHeight={Math.round(markSize * 0.55)}
        className="justify-center"
      />
      {branchName ? <p className="text-muted-foreground text-sm">{branchName}</p> : null}
      {subtitle ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>
      ) : null}
    </div>
  );
}
