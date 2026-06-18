"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDeskSchema = exports.updateDeskSchema = exports.createDeskSchema = void 0;
const zod_1 = require("zod");
exports.createDeskSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100).trim(),
    number: zod_1.z.string().min(1).max(20).trim(),
});
exports.updateDeskSchema = zod_1.z.object({
    name: zod_1.z.string().max(100).trim().optional(),
    status: zod_1.z.enum(['open', 'closed', 'available', 'busy', 'offline']).optional(),
    defaultStationProfileId: zod_1.z.string().uuid().nullable().optional(),
});
exports.assignDeskSchema = zod_1.z.object({
    userIds: zod_1.z.array(zod_1.z.string().uuid()),
});
//# sourceMappingURL=desk.validators.js.map