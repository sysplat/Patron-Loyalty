"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_ID_HEADER = void 0;
exports.newClientRequestId = newClientRequestId;
exports.getApiRequestId = getApiRequestId;
exports.getRequestIdFromHeaders = getRequestIdFromHeaders;
exports.resolveApiRequestId = resolveApiRequestId;
exports.formatRequestIdRef = formatRequestIdRef;
exports.formatUserFacingApiError = formatUserFacingApiError;
/** Canonical HTTP header for request correlation (client ↔ API ↔ workers). */
exports.REQUEST_ID_HEADER = 'x-request-id';
/** Create a new correlation id (browser or Node). */
function newClientRequestId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
/** Extract `requestId` from GlobalExceptionFilter JSON bodies. */
function getApiRequestId(data) {
    if (!data || typeof data !== 'object')
        return undefined;
    const id = data.requestId;
    return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}
/** Read request id from a Fetch Headers / Headers-like map (case-insensitive). */
function getRequestIdFromHeaders(headers) {
    if (!headers)
        return undefined;
    if (typeof headers.get === 'function') {
        const value = headers.get('x-request-id') ?? headers.get('X-Request-ID');
        return value?.trim() || undefined;
    }
    const record = headers;
    const raw = record['x-request-id'] ?? record['X-Request-ID'] ?? record['X-Request-Id'];
    if (Array.isArray(raw))
        return raw[0]?.trim() || undefined;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}
/** Prefer body requestId, then response header, then the id the client sent. */
function resolveApiRequestId(input) {
    return (getApiRequestId(input.body) ||
        getRequestIdFromHeaders(input.responseHeaders) ||
        input.clientRequestId?.trim() ||
        undefined);
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