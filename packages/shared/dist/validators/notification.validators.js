"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUniversalSuppressionSchema = exports.UniversalSuppressionSchema = exports.SuppressionSourceSchema = exports.SuppressionChannelSchema = exports.twilioStatusWebhookSchema = exports.testSmsSchema = exports.sendNotificationSchema = exports.updateNotificationTemplateSchema = exports.createNotificationTemplateSchema = void 0;
const zod_1 = require("zod");
exports.createNotificationTemplateSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(50),
    channel: zod_1.z.string().min(1).max(20),
    subject: zod_1.z.string().max(200).optional(),
    body: zod_1.z.string().min(1),
    variables: zod_1.z.array(zod_1.z.string().max(50)).optional(),
});
exports.updateNotificationTemplateSchema = zod_1.z
    .object({
    subject: zod_1.z.string().max(200).optional(),
    body: zod_1.z.string().min(1).optional(),
    variables: zod_1.z.array(zod_1.z.string().max(50)).optional(),
})
    .strict();
exports.sendNotificationSchema = zod_1.z.object({
    channel: zod_1.z.string().min(1).max(20),
    to: zod_1.z.string().min(1).max(200),
    templateId: zod_1.z.string().uuid().optional(),
    subject: zod_1.z.string().max(200).optional(),
    body: zod_1.z.string().optional(),
    variables: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    messageCategory: zod_1.z.enum(['transactional', 'marketing']).optional(),
    recipientConsent: zod_1.z
        .object({
        transactionalSmsAllowed: zod_1.z.boolean().optional(),
    })
        .optional(),
});
exports.testSmsSchema = zod_1.z.object({
    to: zod_1.z.string().min(1).max(30),
});
exports.twilioStatusWebhookSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string());
exports.SuppressionChannelSchema = zod_1.z.enum(['SMS', 'EMAIL']);
exports.SuppressionSourceSchema = zod_1.z.enum([
    'WEBHOOK_STOP',
    'ADMIN_PORTAL',
    'DSAR_PURGE',
    'SYSTEM',
]);
exports.UniversalSuppressionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orgId: zod_1.z.string().uuid().nullable().optional(),
    contactHash: zod_1.z.string().length(64),
    channel: exports.SuppressionChannelSchema,
    source: exports.SuppressionSourceSchema,
    reason: zod_1.z.string().max(255).nullable().optional(),
    createdAt: zod_1.z.date(),
});
exports.CreateUniversalSuppressionSchema = exports.UniversalSuppressionSchema.omit({
    id: true,
    createdAt: true,
});
//# sourceMappingURL=notification.validators.js.map