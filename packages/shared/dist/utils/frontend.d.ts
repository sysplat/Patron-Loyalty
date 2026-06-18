export declare const WEB_SESSION_COOKIE = "qp-session";
export declare const WEB_REFRESH_COOKIE = "qp-refresh";
export declare const ADMIN_SESSION_COOKIE = "qp-admin-session";
export declare const ADMIN_REFRESH_COOKIE = "qp-admin-refresh";
export declare const DISPLAY_SESSION_COOKIE = "qp-display-session";
export declare const DISPLAY_DEVICE_COOKIE = "qp-display-device";
export declare const DISPLAY_API_KEY_COOKIE = "qp-display-api-key";
/** Default matches API `JWT_ACCESS_TTL` when unset (14_400s / 4h). */
export declare const ACCESS_TOKEN_TTL_SECONDS_DEFAULT = 14400;
/** Fallback when `JWT_ACCESS_TTL` is not available (e.g. client bundle). */
export declare const ACCESS_TOKEN_TTL_SECONDS = 14400;
/**
 * Access-token cookie lifetime — should match API `JWT_ACCESS_TTL`.
 * Server BFF routes should call this with `process.env.JWT_ACCESS_TTL`.
 */
export declare function resolveAccessTokenTtlSeconds(envValue?: string): number;
export declare const REFRESH_TOKEN_TTL_SECONDS: number;
/** Short-lived display JWT cookie — refreshed automatically via apiKey. */
export declare const DISPLAY_SESSION_TTL_SECONDS: number;
/** Long-lived device + apiKey cookies (rolling on each successful refresh). */
export declare const DISPLAY_CREDENTIAL_TTL_SECONDS: number;
export declare function isSecureCookieEnv(): boolean;
/** Ensures browser/server clients target Nest URI versioning (`/api/v1/...`). */
export declare function normalizeApiV1Base(url: string): string;
export declare function getApiBase(): string;
/** Server-side BFF routes: prefer API_URL from the monorepo root when NEXT_PUBLIC_API_URL is unset. */
export declare function getServerApiBase(): string;
/** Reads `error.code` from GlobalExceptionFilter JSON (`{ success: false, error: { code, message } }`). */
export declare function getApiErrorCode(data: unknown): string | undefined;
/** Reads `error.details` when present. */
export declare function getApiErrorDetails(data: unknown): Record<string, unknown> | undefined;
export declare function extractErrorMessage(data: unknown, statusText: string): string;
//# sourceMappingURL=frontend.d.ts.map