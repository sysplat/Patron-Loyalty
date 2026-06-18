"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopQueueSchema = exports.updateQueueSchema = exports.createQueueSchema = void 0;
const zod_1 = require("zod");
const journeyModeSchema = zod_1.z.enum(['single_ticket', 'visit_multi_step']);
const stepRoleSchema = zod_1.z.enum(['service', 'pickup']);
const callingPolicySchema = zod_1.z.enum(['fifo', 'manual_only', 'ready_then_manual', 'ready_then_fifo']);
exports.createQueueSchema = zod_1.z
    .object({
    branchId: zod_1.z.string().uuid('Invalid branch ID'),
    serviceId: zod_1.z.string().uuid('Invalid service ID'),
    name: zod_1.z.string().min(1, 'Queue name is required').max(100).trim(),
    prefix: zod_1.z
        .string()
        .min(1, 'Prefix is required')
        .max(5, 'Prefix must be at most 5 characters')
        .toUpperCase(),
    maxCapacity: zod_1.z.number().int().min(1).max(10000).optional(),
    journeyModeOverride: journeyModeSchema.optional(),
    stepRole: stepRoleSchema.nullish(),
    callingPolicy: callingPolicySchema.optional(),
    flowTemplateId: zod_1.z.string().uuid('Invalid flow template ID').nullish(),
})
    .superRefine((value, ctx) => {
    if (value.journeyModeOverride === 'visit_multi_step' && !value.stepRole) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Step role is required for multi-step queues',
            path: ['stepRole'],
        });
    }
    if (value.stepRole === 'pickup' && value.callingPolicy === 'fifo') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Pickup queues cannot use fifo calling policy',
            path: ['callingPolicy'],
        });
    }
});
exports.updateQueueSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    prefix: zod_1.z.string().min(1).max(5).toUpperCase().optional(),
    maxCapacity: zod_1.z.number().int().min(1).max(10000).nullable().optional(),
    branchId: zod_1.z.string().uuid().optional(),
    serviceId: zod_1.z.string().uuid().optional(),
    journeyModeOverride: journeyModeSchema.nullable().optional(),
    stepRole: stepRoleSchema.nullable().optional(),
    callingPolicy: callingPolicySchema.optional(),
    flowTemplateId: zod_1.z.string().uuid('Invalid flow template ID').nullable().optional(),
})
    .superRefine((value, ctx) => {
    if (value.stepRole === 'pickup' && value.callingPolicy === 'fifo') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Pickup queues cannot use fifo calling policy',
            path: ['callingPolicy'],
        });
    }
});
exports.stopQueueSchema = zod_1.z.object({
    forceCloseWaiting: zod_1.z.boolean().optional(),
    acknowledgeConsequences: zod_1.z.boolean().optional(),
});
// Types are exported from api.types.ts
//# sourceMappingURL=queue.validators.js.map