"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignRoleSchema = exports.updateRolePermissionsSchema = exports.updateRoleSchema = exports.createRoleSchema = void 0;
const zod_1 = require("zod");
exports.createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    description: zod_1.z.string().max(500).optional(),
    permissionIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
});
exports.updateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    description: zod_1.z.string().max(500).optional(),
});
exports.updateRolePermissionsSchema = zod_1.z.object({
    permissionIds: zod_1.z.array(zod_1.z.string().uuid()),
});
exports.assignRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    roleId: zod_1.z.string().uuid(),
    branchId: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=role.validators.js.map