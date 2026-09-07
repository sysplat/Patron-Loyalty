/** Canonical HTTP header for request correlation (client ↔ API ↔ workers). */
export declare const REQUEST_ID_HEADER = "x-request-id";
/** Create a new correlation id (browser or Node). */
export declare function newClientRequestId(): string;
/** Extract `requestId` from GlobalExceptionFilter JSON bodies. */
export declare function getApiRequestId(data: unknown): string | undefined;
/** Read request id from a Fetch Headers / Headers-like map (case-insensitive). */
export declare function getRequestIdFromHeaders(headers: Headers | Record<string, string | string[] | undefined> | null | undefined): string | undefined;
/** Prefer body requestId, then response header, then the id the client sent. */
export declare function resolveApiRequestId(input: {
    body?: unknown;
    responseHeaders?: Headers | Record<string, string | string[] | undefined> | null;
    clientRequestId?: string;
}): string | undefined;
/** Short reference for support (first 8 chars). */
export declare function formatRequestIdRef(requestId: string | undefined): string | undefined;
/**
 * User-facing message with status-aware hints and optional support reference.
 */
export declare function formatUserFacingApiError(input: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
}): string;
//# sourceMappingURL=api-errors.d.ts.map