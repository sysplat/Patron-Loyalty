import Image from 'next/image';
import { cn } from './cn';
import {
  BRAND,
  BRAND_WHITE_FILTER,
  WORDMARK_ASPECT,
  WORDMARK_WHITE_ASPECT,
  type BrandTone,
} from './brand-assets';

type QlessqWordmarkProps = {
  height?: number;
  className?: string;
  priority?: boolean;
  /** `onDark` renders the white wordmark variant (recolored to pure white). */
  tone?: BrandTone;
};

export function QlessqWordmark({
  height = 24,
  className,
  priority,
  tone = 'default',
}: QlessqWordmarkProps) {
  const onDark = tone === 'onDark';
  const width = Math.round(height * (onDark ? WORDMARK_WHITE_ASPECT : WORDMARK_ASPECT));

  return (
    <Image
      src={onDark ? BRAND.wordmarkWhite : BRAND.wordmark}
      alt={BRAND.altWordmark}
      width={width}
      height={height}
      className={cn('shrink-0 object-contain object-left', className)}
      style={onDark ? { filter: BRAND_WHITE_FILTER } : undefined}
      priority={priority}
    />
  );
}
