/** Extract `requestId` from GlobalExceptionFilter JSON bodies. */
export declare function getApiRequestId(data: unknown): string | undefined;
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