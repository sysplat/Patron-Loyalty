import { z } from 'zod';
export declare const setSettingSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    key: string;
    value?: unknown;
}, {
    key: string;
    value?: unknown;
}>;
export declare const setBulkSettingsSchema: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodUnknown>, Record<string, unknown>, Record<string, unknown>>;
export declare const createIntegrationSchema: z.ZodObject<{
    type: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    config: Record<string, unknown>;
}, {
    type: string;
    config: Record<string, unknown>;
}>;
export declare const updateIntegrationSchema: z.ZodObject<{
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
}, "strict", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    config?: Record<string, unknown> | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    config?: Record<string, unknown> | undefined;
}>;
export declare const createSettingsWebhookSchema: z.ZodObject<{
    url: z.ZodString;
    events: z.ZodArray<z.ZodString, "many">;
    secret: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    events: string[];
    secret: string;
}, {
    url: string;
    events: string[];
    secret: string;
}>;
//# sourceMappingURL=settings.validators.d.ts.map