"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWebhookSchema = exports.createWebhookSchema = void 0;
const zod_1 = require("zod");
exports.createWebhookSchema = zod_1.z.object({
    url: zod_1.z
        .string()
        .url()
        .refine((value) => value.startsWith('https://'), {
        message: 'Webhook URL must use https://',
    }),
    events: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
exports.updateWebhookSchema = zod_1.z
    .object({
    url: zod_1.z
        .string()
        .url()
        .refine((value) => value.startsWith('https://'), {
        message: 'Webhook URL must use https://',
    })
        .optional(),
    events: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
})
    .strict();
//# sourceMappingURL=webhook.validators.js.map