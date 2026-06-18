"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guidedSetupDeploySchema = exports.guidedSetupMultiDeploySchema = exports.guidedSetupSingleDeploySchema = exports.guidedSingleQueueInputSchema = exports.guidedServiceInputSchema = void 0;
exports.validateGuidedMultiSteps = validateGuidedMultiSteps;
exports.validateGuidedSingleQueuePrefix = validateGuidedSingleQueuePrefix;
const zod_1 = require("zod");
const common_validators_1 = require("./common.validators");
const guidedServiceNewSchema = zod_1.z.object({
    mode: zod_1.z.literal('new'),
    name: zod_1.z.string().min(1).max(100).trim(),
    description: zod_1.z.string().max(500).optional(),
    durationMinutes: zod_1.z.number().int().min(1).max(480),
    serviceEstimateLowMinutes: zod_1.z.number().int().min(1),
    serviceEstimateHighMinutes: zod_1.z.number().int().min(1),
    instructionalTip: zod_1.z.string().max(500).nullable().optional(),
});
const guidedServiceExistingSchema = zod_1.z.object({
    mode: zod_1.z.literal('existing'),
    serviceId: common_validators_1.uuidSchema,
});
exports.guidedServiceInputSchema = zod_1.z
    .discriminatedUnion('mode', [guidedServiceNewSchema, guidedServiceExistingSchema])
    .superRefine((value, ctx) => {
    if (value.mode !== 'new')
        return;
    if (value.serviceEstimateLowMinutes > value.serviceEstimateHighMinutes) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Minimum estimate cannot exceed maximum estimate',
            path: ['serviceEstimateHighMinutes'],
        });
    }
});
const guidedQueueNewSchema = zod_1.z.object({
    mode: zod_1.z.literal('new'),
    name: zod_1.z.string().min(1).max(100).trim(),
    prefix: zod_1.z.string().min(1).max(5).toUpperCase(),
    callingPolicy: common_validators_1.callingPolicySchema,
});
const guidedQueueExistingSchema = zod_1.z.object({
    mode: zod_1.z.literal('existing'),
    queueId: common_validators_1.uuidSchema,
});
exports.guidedSingleQueueInputSchema = zod_1.z.discriminatedUnion('mode', [
    guidedQueueNewSchema,
    guidedQueueExistingSchema,
]);
const guidedStepQueueNewSchema = zod_1.z.object({
    mode: zod_1.z.literal('new'),
    name: zod_1.z.string().min(1).max(100).trim(),
    prefix: zod_1.z.string().min(1).max(5).toUpperCase(),
});
const guidedStepQueueExistingSchema = zod_1.z.object({
    mode: zod_1.z.literal('existing'),
    queueId: common_validators_1.uuidSchema,
});
const guidedMultiStepSchema = zod_1.z.object({
    deskNumber: common_validators_1.deskNumberSchema,
    stepRole: common_validators_1.stepRoleSchema,
    callingPolicy: common_validators_1.callingPolicySchema,
    queue: zod_1.z.discriminatedUnion('mode', [guidedStepQueueNewSchema, guidedStepQueueExistingSchema]),
});
exports.guidedSetupSingleDeploySchema = zod_1.z.object({
    flowType: zod_1.z.literal('single'),
    branchId: common_validators_1.uuidSchema,
    service: exports.guidedServiceInputSchema,
    queue: exports.guidedSingleQueueInputSchema,
});
exports.guidedSetupMultiDeploySchema = zod_1.z.object({
    flowType: zod_1.z.literal('multi'),
    branchId: common_validators_1.uuidSchema,
    service: exports.guidedServiceInputSchema,
    templateName: zod_1.z.string().min(1).max(100).trim(),
    autoActivate: zod_1.z.boolean().optional().default(true),
    steps: zod_1.z.array(guidedMultiStepSchema).min(2, 'Multi-step journeys require at least two steps'),
});
exports.guidedSetupDeploySchema = zod_1.z.discriminatedUnion('flowType', [
    exports.guidedSetupSingleDeploySchema,
    exports.guidedSetupMultiDeploySchema,
]);
/** Client-side / shared validation for multi-step guided builder drafts. */
function validateGuidedMultiSteps(steps, branchQueues = []) {
    if (steps.length < 2)
        return 'Multi-step journeys require at least two steps';
    if (steps[0]?.stepRole !== 'service')
        return 'First step must be a service step';
    const queueIds = new Set();
    const newPrefixes = new Set();
    for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        if (!step.deskNumber)
            return `Step ${i + 1}: serving desk is required`;
        if (step.mode === 'existing') {
            if (!step.selectedQueueId)
                return `Step ${i + 1}: select a queue`;
            if (queueIds.has(step.selectedQueueId)) {
                return `Step ${i + 1}: the same queue cannot appear in multiple steps`;
            }
            queueIds.add(step.selectedQueueId);
        }
        else {
            const prefix = step.newQueuePrefix?.trim().toUpperCase() ?? '';
            if (!prefix)
                return `Step ${i + 1}: ticket prefix is required`;
            if (newPrefixes.has(prefix)) {
                return `Step ${i + 1}: ticket prefix "${prefix}" is already used in this journey`;
            }
            const branchPrefixError = validateGuidedSingleQueuePrefix(prefix, branchQueues, [
                ...newPrefixes,
            ]);
            if (branchPrefixError) {
                return `Step ${i + 1}: ${branchPrefixError}`;
            }
            newPrefixes.add(prefix);
        }
        if (step.stepRole === 'pickup' && step.callingPolicy === 'fifo') {
            return `Step ${i + 1}: pickup steps cannot use strict FIFO calling`;
        }
    }
    return null;
}
function validateGuidedSingleQueuePrefix(prefix, branchQueues, existingPrefixesInDraft = []) {
    const normalized = prefix.trim().toUpperCase();
    if (!normalized)
        return 'Ticket prefix is required';
    if (existingPrefixesInDraft.includes(normalized)) {
        return `Ticket prefix "${normalized}" is already used in this setup`;
    }
    const clash = branchQueues.find((q) => (q.prefix ?? '').toUpperCase() === normalized);
    if (clash)
        return `Ticket prefix "${normalized}" is already used in this branch`;
    return null;
}
//# sourceMappingURL=guided-setup.validators.js.map