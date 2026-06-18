"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFlowTemplateSchema = exports.createFlowTemplateSchema = void 0;
const zod_1 = require("zod");
const common_validators_1 = require("./common.validators");
const flowStepSchema = zod_1.z.object({
    stepIndex: zod_1.z.number().int().min(0),
    deskNumber: common_validators_1.deskNumberSchema,
    serviceId: common_validators_1.uuidSchema,
    queueId: common_validators_1.uuidSchema,
    stepRole: common_validators_1.stepRoleSchema,
    callingPolicy: common_validators_1.callingPolicySchema,
});
exports.createFlowTemplateSchema = zod_1.z
    .object({
    branchId: common_validators_1.uuidSchema,
    name: zod_1.z.string().min(1).max(100).trim(),
    steps: zod_1.z.array(flowStepSchema).min(2, 'Multi-step templates require at least two steps'),
})
    .superRefine((value, ctx) => {
    const queueIds = value.steps.map((step) => step.queueId);
    const uniqueQueueIds = new Set(queueIds);
    if (uniqueQueueIds.size !== queueIds.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Each step must use a different queue',
            path: ['steps'],
        });
    }
    const sorted = [...value.steps].sort((a, b) => a.stepIndex - b.stepIndex);
    for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i]?.stepIndex !== i + 1) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Step indices must be sequential starting at 1',
                path: ['steps'],
            });
            break;
        }
    }
    const deskNumbers = value.steps.map((step) => step.deskNumber);
    if (new Set(deskNumbers).size !== deskNumbers.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Each step must use a different serving desk',
            path: ['steps'],
        });
    }
});
exports.updateFlowTemplateSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    steps: zod_1.z
        .array(flowStepSchema)
        .min(2, 'Multi-step templates require at least two steps')
        .optional(),
})
    .superRefine((value, ctx) => {
    if (!value.steps)
        return;
    const queueIds = value.steps.map((step) => step.queueId);
    if (new Set(queueIds).size !== queueIds.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Each step must use a different queue',
            path: ['steps'],
        });
    }
});
//# sourceMappingURL=flow-template.validators.js.map