"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubServiceSchema = exports.createSubServiceSchema = exports.branchQueueSettingsSchema = exports.createServiceCategorySchema = exports.updateServiceSchema = exports.createServiceSchema = exports.createServiceFieldsSchema = void 0;
const zod_1 = require("zod");
const common_validators_1 = require("./common.validators");
const createServiceFieldsSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Service name is required').max(100).trim(),
    description: zod_1.z.string().max(500).optional(),
    durationMinutes: zod_1.z.number().int().min(1, 'Service duration is required').max(480),
    categoryId: zod_1.z.string().uuid().optional(),
    branchIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    queueEnabled: zod_1.z.boolean().optional(),
    appointmentEnabled: zod_1.z.boolean().optional(),
    appointmentSlotInterval: zod_1.z.number().int().min(1).optional(),
    appointmentLeadTimeMinutes: zod_1.z.number().int().min(0).optional(),
    appointmentMaxAdvanceDays: zod_1.z.number().int().min(1).optional(),
    appointmentBufferMinutes: zod_1.z.number().int().min(0).optional(),
    appointmentRequiresEmail: zod_1.z.boolean().optional(),
    serviceEstimateLowMinutes: zod_1.z.number().int().min(1, 'Minimum timing is required'),
    serviceEstimateHighMinutes: zod_1.z.number().int().min(1, 'Maximum timing is required'),
    journeyModeOverride: common_validators_1.journeyModeSchema.nullable().optional(),
    instructionalTip: zod_1.z.string().max(500).nullable().optional(),
    icon: zod_1.z.string().max(50).nullable().optional(),
});
exports.createServiceFieldsSchema = createServiceFieldsSchema;
exports.createServiceSchema = createServiceFieldsSchema.refine((value) => value.serviceEstimateLowMinutes <= value.serviceEstimateHighMinutes, {
    message: 'Minimum estimate cannot exceed maximum estimate',
    path: ['serviceEstimateHighMinutes'],
});
exports.updateServiceSchema = createServiceFieldsSchema.partial().extend({
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
exports.createServiceCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).trim(),
    icon: zod_1.z.string().max(50).optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
exports.branchQueueSettingsSchema = zod_1.z.object({
    serviceEstimateLowMinutes: zod_1.z.number().int().min(0).optional(),
    serviceEstimateHighMinutes: zod_1.z.number().int().min(0).optional(),
    journeyModeOverride: common_validators_1.journeyModeSchema.nullable().optional(),
});
exports.createSubServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    description: zod_1.z.string().max(500).optional(),
    durationMinutes: zod_1.z.number().int().min(1).max(480).optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
exports.updateSubServiceSchema = exports.createSubServiceSchema.partial();
//# sourceMappingURL=service.validators.js.map