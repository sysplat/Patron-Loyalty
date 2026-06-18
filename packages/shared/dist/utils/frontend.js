"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISPLAY_CREDENTIAL_TTL_SECONDS = exports.DISPLAY_SESSION_TTL_SECONDS = exports.REFRESH_TOKEN_TTL_SECONDS = exports.ACCESS_TOKEN_TTL_SECONDS = exports.ACCESS_TOKEN_TTL_SECONDS_DEFAULT = exports.DISPLAY_API_KEY_COOKIE = exports.DISPLAY_DEVICE_COOKIE = exports.DISPLAY_SESSION_COOKIE = exports.ADMIN_REFRESH_COOKIE = exports.ADMIN_SESSION_COOKIE = exports.WEB_REFRESH_COOKIE = exports.WEB_SESSION_COOKIE = void 0;
exports.resolveAccessTokenTtlSeconds = resolveAccessTokenTtlSeconds;
exports.isSecureCookieEnv = isSecureCookieEnv;
exports.normalizeApiV1Base = normalizeApiV1Base;
exports.getApiBase = getApiBase;
exports.getServerApiBase = getServerApiBase;
exports.getApiErrorCode = getApiErrorCode;
exports.getApiErrorDetails = getApiErrorDetails;
exports.extractErrorMessage = extractErrorMessage;
exports.WEB_SESSION_COOKIE = 'qp-session';
exports.WEB_REFRESH_COOKIE = 'qp-refresh';
exports.ADMIN_SESSION_COOKIE = 'qp-admin-session';
exports.ADMIN_REFRESH_COOKIE = 'qp-admin-refresh';
exports.DISPLAY_SESSION_COOKIE = 'qp-display-session';
exports.DISPLAY_DEVICE_COOKIE = 'qp-display-device';
exports.DISPLAY_API_KEY_COOKIE = 'qp-display-api-key';
/** Default matches API `JWT_ACCESS_TTL` when unset (14_400s / 4h). */
exports.ACCESS_TOKEN_TTL_SECONDS_DEFAULT = 14_400;
/** Fallback when `JWT_ACCESS_TTL` is not available (e.g. client bundle). */
exports.ACCESS_TOKEN_TTL_SECONDS = exports.ACCESS_TOKEN_TTL_SECONDS_DEFAULT;
/**
 * Access-token cookie lifetime — should match API `JWT_ACCESS_TTL`.
 * Server BFF routes should call this with `process.env.JWT_ACCESS_TTL`.
 */
function resolveAccessTokenTtlSeconds(envValue) {
    const raw = envValue ?? (typeof process !== 'undefined' ? process.env.JWT_ACCESS_TTL : undefined);
    if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    return exports.ACCESS_TOKEN_TTL_SECONDS_DEFAULT;
}
exports.REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
/** Short-lived display JWT cookie — refreshed automatically via apiKey. */
exports.DISPLAY_SESSION_TTL_SECONDS = 60 * 60 * 24;
/** Long-lived device + apiKey cookies (rolling on each successful refresh). */
exports.DISPLAY_CREDENTIAL_TTL_SECONDS = 60 * 60 * 24 * 365;
function isSecureCookieEnv() {
    return process.env.NODE_ENV === 'production';
}
/** Ensures browser/server clients target Nest URI versioning (`/api/v1/...`). */
function normalizeApiV1Base(url) {
    const base = url.replace(/\/$/, '');
    if (base.startsWith('/')) {
        return base.endsWith('/api/v1') ? base : `${base}/api/v1`.replace(/\/+/g, '/');
    }
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}
function getApiBase() {
    const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    return normalizeApiV1Base(raw);
}
/** Server-side BFF routes: prefer API_URL from the monorepo root when NEXT_PUBLIC_API_URL is unset. */
function getServerApiBase() {
    const apiUrl = process.env.API_URL?.replace(/\/$/, '');
    if (apiUrl) {
        return normalizeApiV1Base(apiUrl);
    }
    return getApiBase();
}
function readApiErrorBody(data) {
    if (!data || typeof data !== 'object')
        return null;
    return data;
}
/** Reads `error.code` from GlobalExceptionFilter JSON (`{ success: false, error: { code, message } }`). */
function getApiErrorCode(data) {
    const body = readApiErrorBody(data);
    const err = body?.error;
    if (err && typeof err === 'object' && typeof err.code === 'string')
        return err.code;
    return undefined;
}
/** Reads `error.details` when present. */
function getApiErrorDetails(data) {
    const body = readApiErrorBody(data);
    const err = body?.error;
    if (err && typeof err === 'object' && err.details && typeof err.details === 'object') {
        return err.details;
    }
    return undefined;
}
function extractErrorMessage(data, statusText) {
    const body = readApiErrorBody(data);
    if (!body)
        return statusText;
    const errObj = body.error && typeof body.error === 'object' ? body.error : null;
    const validationErrors = errObj?.details?.validationErrors;
    if (Array.isArray(validationErrors) &&
        validationErrors.length > 0 &&
        typeof validationErrors[0] === 'string') {
        return validationErrors[0];
    }
    if (typeof body.message === 'string')
        return body.message;
    if (Array.isArray(body.message) && body.message.length > 0)
        return body.message[0] ?? statusText;
    if (typeof body.error === 'string')
        return body.error;
    if (errObj && typeof errObj.message === 'string') {
        return errObj.message;
    }
    return statusText;
}
//# sourceMappingURL=frontend.js.map