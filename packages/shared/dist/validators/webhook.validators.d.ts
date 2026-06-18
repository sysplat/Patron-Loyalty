import { z } from 'zod';
export declare const createWebhookSchema: z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
    events: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    url: string;
    events: string[];
}, {
    url: string;
    events: string[];
}>;
export declare const updateWebhookSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    events: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
}, "strict", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    url?: string | undefined;
    events?: string[] | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    url?: string | undefined;
    events?: string[] | undefined;
}>;
//# sourceMappingURL=webhook.validators.d.ts.map