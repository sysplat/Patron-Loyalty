import Image from 'next/image';
import { cn } from './cn';
import { BRAND, BRAND_WHITE_FILTER, type BrandTone } from './brand-assets';

type QlessqLogoMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  /** `onDark` renders the white logo variant (recolored to pure white). */
  tone?: BrandTone;
};

export function QlessqLogoMark({
  size = 32,
  className,
  priority,
  tone = 'default',
}: QlessqLogoMarkProps) {
  const onDark = tone === 'onDark';
  return (
    <Image
      src={onDark ? BRAND.logoMarkWhite : BRAND.logoMark}
      alt={BRAND.altMark}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      style={onDark ? { filter: BRAND_WHITE_FILTER } : undefined}
      priority={priority}
    />
  );
}
