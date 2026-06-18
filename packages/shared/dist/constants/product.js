"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_PLAN_SLUG = exports.PRODUCT_SKU_VALUES = exports.PRODUCT_SKUS = void 0;
exports.hasQueueProduct = hasQueueProduct;
exports.hasLoyaltyProduct = hasLoyaltyProduct;
/** Commercial product SKU — which surfaces an org purchased. */
exports.PRODUCT_SKUS = {
    QMS: 'qms',
    LOYALTY: 'loyalty',
    BUNDLE: 'bundle',
};
exports.PRODUCT_SKU_VALUES = Object.values(exports.PRODUCT_SKUS);
exports.LOYALTY_PLAN_SLUG = 'loyalty-starter';
/** Queue management (kiosk, serve, workbench) is licensed. */
function hasQueueProduct(productSku) {
    const sku = productSku ?? exports.PRODUCT_SKUS.QMS;
    return sku === exports.PRODUCT_SKUS.QMS || sku === exports.PRODUCT_SKUS.BUNDLE;
}
/** Patron loyalty / CRM is licensed (standalone SKU or QMS add-on). */
function hasLoyaltyProduct(productSku, patronCrmEnabled) {
    const sku = productSku ?? exports.PRODUCT_SKUS.QMS;
    if (sku === exports.PRODUCT_SKUS.LOYALTY || sku === exports.PRODUCT_SKUS.BUNDLE)
        return true;
    return patronCrmEnabled === true;
}
//# sourceMappingURL=product.js.map