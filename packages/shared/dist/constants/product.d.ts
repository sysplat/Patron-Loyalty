/** Commercial product SKU — which surfaces an org purchased. */
export declare const PRODUCT_SKUS: {
    readonly QMS: "qms";
    readonly LOYALTY: "loyalty";
    readonly BUNDLE: "bundle";
};
export type ProductSku = (typeof PRODUCT_SKUS)[keyof typeof PRODUCT_SKUS];
export declare const PRODUCT_SKU_VALUES: [ProductSku, ...ProductSku[]];
export declare const LOYALTY_PLAN_SLUG = "loyalty-starter";
/** Queue management (kiosk, serve, workbench) is licensed. */
export declare function hasQueueProduct(productSku: string | null | undefined): boolean;
/** Patron loyalty / CRM is licensed (standalone SKU or QMS add-on). */
export declare function hasLoyaltyProduct(productSku: string | null | undefined, patronCrmEnabled?: boolean): boolean;
//# sourceMappingURL=product.d.ts.map