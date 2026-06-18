/**
 * Whether a workbench API error is a harmless duplicate click (refresh UI, no user toast).
 * Used by the journey workbench and unit tests; pass code/details from ApiError or raw JSON.
 */
export declare function isBenignWorkbenchActionErrorPayload(code: string | undefined, details: Record<string, unknown> | undefined): boolean;
//# sourceMappingURL=workbench-errors.d.ts.map