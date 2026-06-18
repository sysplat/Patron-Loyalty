"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiRequestId = getApiRequestId;
exports.formatRequestIdRef = formatRequestIdRef;
exports.formatUserFacingApiError = formatUserFacingApiError;
/** Extract `requestId` from GlobalExceptionFilter JSON bodies. */
function getApiRequestId(data) {
    if (!data || typeof data !== 'object')
        return undefined;
    const id = data.requestId;
    return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}
/** Short reference for support (first 8 chars). */
function formatRequestIdRef(requestId) {
    if (!requestId)
        return undefined;
    const trimmed = requestId.trim();
    if (trimmed.length <= 12)
        return trimmed;
    return trimmed.slice(0, 8);
}
/**
 * User-facing message with status-aware hints and optional support reference.
 */
function formatUserFacingApiError(input) {
    const ref = formatRequestIdRef(input.requestId);
    const refSuffix = ref ? ` Reference: ${ref}.` : '';
    if (input.status >= 500) {
        return `${input.message || 'Something went wrong on our servers.'} Please try again.${refSuffix}`;
    }
    if (input.status === 401) {
        return input.message || 'Your session has expired. Please sign in again.';
    }
    if (input.status === 403) {
        return `${input.message || 'You do not have permission to do that.'}${refSuffix}`;
    }
    if (input.status === 404) {
        const fallback = input.code === 'NOT_FOUND' ? 'That resource was not found.' : 'Not found.';
        const message = input.message?.trim() || fallback;
        if (message !== fallback) {
            return message;
        }
        return `${message} If this persists, check that the app and API versions match.${refSuffix}`;
    }
    if (input.status === 409) {
        return input.message || 'This action conflicts with current data. Refresh and try again.';
    }
    if (input.status === 429) {
        return input.message || 'Too many requests. Wait a moment and try again.';
    }
    return input.message || 'Request failed.';
}
//# sourceMappingURL=api-errors.js.map