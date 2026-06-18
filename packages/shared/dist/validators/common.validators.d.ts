import { z } from 'zod';
/** Loose JSON object for partial update endpoints that accept arbitrary keys. */
export declare const jsonRecordSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
/** Centrifugo proxy webhook payload (connect / disconnect / etc.). */
export declare const centrifugoWebhookSchema: z.ZodObject<{
    method: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    method: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    method: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const uuidSchema: z.ZodString;
export declare const deskNumberSchema: z.ZodString;
export declare const ticketSourceSchema: z.ZodEnum<["walk_in", "online", "kiosk", "staff", "public"]>;
export declare const callingPolicySchema: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
export declare const stepRoleSchema: z.ZodEnum<["service", "pickup"]>;
export declare const journeyModeSchema: z.ZodEnum<["single_ticket", "visit_multi_step"]>;
//# sourceMappingURL=common.validators.d.ts.map