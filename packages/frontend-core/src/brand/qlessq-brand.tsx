import Link from 'next/link';
import { cn } from './cn';
import type { BrandTone } from './brand-assets';
import { QlessqLogoMark } from './qlessq-logo-mark';
import { QlessqWordmark } from './qlessq-wordmark';

type QlessqBrandProps = {
  href?: string | null;
  markSize?: number;
  wordmarkHeight?: number;
  showMark?: boolean;
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  priority?: boolean;
  /** `onDark` renders the white brand variant for dark backgrounds. */
  tone?: BrandTone;
};

export function QlessqBrand({
  href = '/',
  markSize = 36,
  wordmarkHeight = 22,
  showMark = true,
  showWordmark = true,
  className,
  markClassName,
  wordmarkClassName,
  priority,
  tone = 'default',
}: QlessqBrandProps) {
  const content = (
    <>
      {showMark ? (
        <QlessqLogoMark size={markSize} className={markClassName} priority={priority} tone={tone} />
      ) : null}
      {showWordmark ? (
        <QlessqWordmark
          height={wordmarkHeight}
          className={wordmarkClassName}
          priority={priority}
          tone={tone}
        />
      ) : null}
    </>
  );

  const classes = cn('inline-flex items-center gap-2.5', className);

  if (href) {
    return (
      <Link href={href} className={cn(classes, 'transition-opacity hover:opacity-90')}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
