"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSettingsWebhookSchema = exports.updateIntegrationSchema = exports.createIntegrationSchema = exports.setBulkSettingsSchema = exports.setSettingSchema = void 0;
const zod_1 = require("zod");
exports.setSettingSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(200),
    value: zod_1.z.unknown(),
});
exports.setBulkSettingsSchema = zod_1.z
    .record(zod_1.z.string().min(1).max(200), zod_1.z.unknown())
    .refine((settings) => Object.keys(settings).length > 0, {
    message: 'At least one setting is required',
});
exports.createIntegrationSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(50),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.updateIntegrationSchema = zod_1.z
    .object({
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
})
    .strict();
exports.createSettingsWebhookSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    events: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    secret: zod_1.z.string().min(1).max(200),
});
//# sourceMappingURL=settings.validators.js.map