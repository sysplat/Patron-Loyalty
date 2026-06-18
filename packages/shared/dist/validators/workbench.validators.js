"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workbenchCancelSchema = exports.workbenchCompleteSchema = exports.workbenchTicketActionSchema = exports.workbenchCallSpecificSchema = exports.workbenchCallNextSchema = exports.workbenchSessionSchema = exports.agentSessionHeartbeatSchema = exports.startAgentSessionSchema = exports.updateStationProfileSchema = exports.createStationProfileSchema = exports.stationProfileQueueSchema = void 0;
const zod_1 = require("zod");
const workbench_1 = require("../constants/workbench");
const common_validators_1 = require("./common.validators");
const stationCapabilitySchema = zod_1.z.enum(workbench_1.ALL_STATION_CAPABILITIES);
exports.stationProfileQueueSchema = zod_1.z.object({
    queueId: common_validators_1.uuidSchema,
    sortOrder: zod_1.z.number().int().min(0).optional(),
    visibilityOnly: zod_1.z.boolean().optional(),
    capabilities: zod_1.z.array(stationCapabilitySchema).optional(),
});
exports.createStationProfileSchema = zod_1.z.object({
    branchId: common_validators_1.uuidSchema,
    name: zod_1.z.string().min(1).max(100).trim(),
    primaryQueueId: common_validators_1.uuidSchema.nullable().optional(),
    flowTemplateId: common_validators_1.uuidSchema.nullable().optional(),
    isDefault: zod_1.z.boolean().optional(),
    queues: zod_1.z.array(exports.stationProfileQueueSchema).min(1),
});
exports.updateStationProfileSchema = exports.createStationProfileSchema.partial();
exports.startAgentSessionSchema = zod_1.z.object({
    branchId: common_validators_1.uuidSchema,
    stationProfileId: common_validators_1.uuidSchema,
    deskId: common_validators_1.uuidSchema.nullable().optional(),
    deskNumber: common_validators_1.deskNumberSchema.nullable().optional(),
    surface: zod_1.z.string().max(30).optional(),
});
exports.agentSessionHeartbeatSchema = zod_1.z.object({
    sessionId: common_validators_1.uuidSchema.optional(),
    surface: zod_1.z.string().max(30).optional(),
});
exports.workbenchSessionSchema = zod_1.z.object({
    branchId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema,
    stationProfileId: common_validators_1.uuidSchema.optional(),
});
const workbenchActionBase = {
    stationProfileId: common_validators_1.uuidSchema,
    ticketId: common_validators_1.uuidSchema,
};
exports.workbenchCallNextSchema = zod_1.z.object({
    stationProfileId: common_validators_1.uuidSchema,
    queueId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema,
    deskFilterActive: zod_1.z.boolean().optional(),
});
exports.workbenchCallSpecificSchema = zod_1.z.object({
    ...workbenchActionBase,
    deskNumber: common_validators_1.deskNumberSchema,
});
exports.workbenchTicketActionSchema = zod_1.z.object(workbenchActionBase);
exports.workbenchCompleteSchema = zod_1.z.object({
    ...workbenchActionBase,
    externalRef: zod_1.z.string().max(100).optional(),
});
exports.workbenchCancelSchema = zod_1.z.object({
    ...workbenchActionBase,
    reason: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=workbench.validators.js.map