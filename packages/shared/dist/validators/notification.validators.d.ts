import { z } from 'zod';
export declare const createNotificationTemplateSchema: z.ZodObject<{
    type: z.ZodString;
    channel: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    variables: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: string;
    channel: string;
    body: string;
    subject?: string | undefined;
    variables?: string[] | undefined;
}, {
    type: string;
    channel: string;
    body: string;
    subject?: string | undefined;
    variables?: string[] | undefined;
}>;
export declare const updateNotificationTemplateSchema: z.ZodObject<{
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    subject?: string | undefined;
    body?: string | undefined;
    variables?: string[] | undefined;
}, {
    subject?: string | undefined;
    body?: string | undefined;
    variables?: string[] | undefined;
}>;
export declare const sendNotificationSchema: z.ZodObject<{
    channel: z.ZodString;
    to: z.ZodString;
    templateId: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    messageCategory: z.ZodOptional<z.ZodEnum<["transactional", "marketing"]>>;
    recipientConsent: z.ZodOptional<z.ZodObject<{
        transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transactionalSmsAllowed?: boolean | undefined;
    }, {
        transactionalSmsAllowed?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    channel: string;
    to: string;
    subject?: string | undefined;
    body?: string | undefined;
    variables?: Record<string, string> | undefined;
    templateId?: string | undefined;
    messageCategory?: "transactional" | "marketing" | undefined;
    recipientConsent?: {
        transactionalSmsAllowed?: boolean | undefined;
    } | undefined;
}, {
    channel: string;
    to: string;
    subject?: string | undefined;
    body?: string | undefined;
    variables?: Record<string, string> | undefined;
    templateId?: string | undefined;
    messageCategory?: "transactional" | "marketing" | undefined;
    recipientConsent?: {
        transactionalSmsAllowed?: boolean | undefined;
    } | undefined;
}>;
export declare const testSmsSchema: z.ZodObject<{
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
}, {
    to: string;
}>;
export declare const twilioStatusWebhookSchema: z.ZodRecord<z.ZodString, z.ZodString>;
export declare const SuppressionChannelSchema: z.ZodEnum<["SMS", "EMAIL"]>;
export declare const SuppressionSourceSchema: z.ZodEnum<["WEBHOOK_STOP", "ADMIN_PORTAL", "DSAR_PURGE", "SYSTEM"]>;
export declare const UniversalSuppressionSchema: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contactHash: z.ZodString;
    channel: z.ZodEnum<["SMS", "EMAIL"]>;
    source: z.ZodEnum<["WEBHOOK_STOP", "ADMIN_PORTAL", "DSAR_PURGE", "SYSTEM"]>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    source: "WEBHOOK_STOP" | "ADMIN_PORTAL" | "DSAR_PURGE" | "SYSTEM";
    channel: "SMS" | "EMAIL";
    id: string;
    contactHash: string;
    createdAt: Date;
    reason?: string | null | undefined;
    orgId?: string | null | undefined;
}, {
    source: "WEBHOOK_STOP" | "ADMIN_PORTAL" | "DSAR_PURGE" | "SYSTEM";
    channel: "SMS" | "EMAIL";
    id: string;
    contactHash: string;
    createdAt: Date;
    reason?: string | null | undefined;
    orgId?: string | null | undefined;
}>;
export declare const CreateUniversalSuppressionSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contactHash: z.ZodString;
    channel: z.ZodEnum<["SMS", "EMAIL"]>;
    source: z.ZodEnum<["WEBHOOK_STOP", "ADMIN_PORTAL", "DSAR_PURGE", "SYSTEM"]>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodDate;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    source: "WEBHOOK_STOP" | "ADMIN_PORTAL" | "DSAR_PURGE" | "SYSTEM";
    channel: "SMS" | "EMAIL";
    contactHash: string;
    reason?: string | null | undefined;
    orgId?: string | null | undefined;
}, {
    source: "WEBHOOK_STOP" | "ADMIN_PORTAL" | "DSAR_PURGE" | "SYSTEM";
    channel: "SMS" | "EMAIL";
    contactHash: string;
    reason?: string | null | undefined;
    orgId?: string | null | undefined;
}>;
//# sourceMappingURL=notification.validators.d.ts.map