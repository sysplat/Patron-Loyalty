export const BRAND = {
  logoMark: '/brand/qplatform-logo.png',
  wordmark: '/brand/qplatform-text.png',
  // White-on-dark assets. The source artwork is solid dark on transparent, so
  // it is recolored to white at render time (see `tone="onDark"` on the brand
  // components); this keeps one source of truth and guarantees a crisp white.
  logoMarkWhite: '/brand/qplatform-logo-white.png',
  wordmarkWhite: '/brand/qplatform-text-white.png',
  altMark: 'QPlatform',
  altWordmark: 'QPlatform',
} as const;

/** Source wordmark aspect ratio (2853×1619). */
export const WORDMARK_ASPECT = 2853 / 1619;

/** White wordmark source aspect ratio (2815×1548). */
export const WORDMARK_WHITE_ASPECT = 2815 / 1548;

/** CSS filter that recolors the dark source artwork to pure white. */
export const BRAND_WHITE_FILTER = 'brightness(0) invert(1)';

export type BrandTone = 'default' | 'onDark';
