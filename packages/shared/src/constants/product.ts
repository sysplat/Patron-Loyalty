/** Commercial product SKU — which surfaces an org purchased. */
export const PRODUCT_SKUS = {
  QMS: 'qms',
  LOYALTY: 'loyalty',
  BUNDLE: 'bundle',
} as const;

export type ProductSku = (typeof PRODUCT_SKUS)[keyof typeof PRODUCT_SKUS];

export const PRODUCT_SKU_VALUES = Object.values(PRODUCT_SKUS) as [ProductSku, ...ProductSku[]];

export const LOYALTY_PLAN_SLUG = 'loyalty-starter';

/** Queue management (kiosk, serve, workbench) is licensed. */
export function hasQueueProduct(productSku: string | null | undefined): boolean {
  const sku = productSku ?? PRODUCT_SKUS.QMS;
  return sku === PRODUCT_SKUS.QMS || sku === PRODUCT_SKUS.BUNDLE;
}

/** Patron loyalty / CRM is licensed (standalone SKU or QMS add-on). */
export function hasLoyaltyProduct(
  productSku: string | null | undefined,
  patronCrmEnabled?: boolean,
): boolean {
  const sku = productSku ?? PRODUCT_SKUS.QMS;
  if (sku === PRODUCT_SKUS.LOYALTY || sku === PRODUCT_SKUS.BUNDLE) return true;
  return patronCrmEnabled === true;
}
