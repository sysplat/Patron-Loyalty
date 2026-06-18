import { z } from 'zod';
/** Admin links a TV-shown code to a branch (reverse pairing). */
export declare const linkDisplayScreenSchema: z.ZodObject<{
    code: z.ZodString;
    branchId: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    deviceId: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    branchId: string;
    name?: string | undefined;
    deviceId?: string | undefined;
    deviceType?: string | undefined;
}, {
    code: string;
    branchId: string;
    name?: string | undefined;
    deviceId?: string | undefined;
    deviceType?: string | undefined;
}>;
export declare const claimReversePairingSchema: z.ZodObject<{
    sessionId: z.ZodString;
    deviceFingerprint: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    deviceFingerprint: string;
}, {
    sessionId: string;
    deviceFingerprint: string;
}>;
export declare const refreshDisplayTokenSchema: z.ZodObject<{
    apiKey: z.ZodString;
    deviceFingerprint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    deviceFingerprint?: string | undefined;
}, {
    apiKey: string;
    deviceFingerprint?: string | undefined;
}>;
export declare const createDisplayThemeSchema: z.ZodObject<{
    name: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    config: Record<string, unknown>;
}, {
    name: string;
    config: Record<string, unknown>;
}>;
export declare const updateDisplayDeviceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    themeId: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
    themeId?: string | undefined;
}, {
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
    themeId?: string | undefined;
}>;
export declare const updateDisplayThemeSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=display.validators.d.ts.map