"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.setUserPasswordSchema = exports.inviteUserSchema = void 0;
const zod_1 = require("zod");
const auth_validators_1 = require("./auth.validators");
exports.inviteUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase().trim(),
    firstName: zod_1.z.string().min(1).max(100).trim(),
    lastName: zod_1.z.string().min(1).max(100).trim(),
    roleId: zod_1.z.string().uuid(),
    password: auth_validators_1.passwordSchema,
    branchIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.setUserPasswordSchema = zod_1.z.object({
    password: auth_validators_1.passwordSchema,
});
exports.updateUserSchema = zod_1.z
    .object({
    firstName: zod_1.z.string().min(1).max(100).trim().optional(),
    lastName: zod_1.z.string().min(1).max(100).trim().optional(),
    phone: zod_1.z.string().max(30).trim().optional(),
    description: zod_1.z.string().max(500).trim().optional(),
    language: zod_1.z.string().max(10).trim().optional(),
    timezone: zod_1.z.string().max(64).trim().optional(),
    avatarUrl: zod_1.z.string().max(2000).trim().optional(),
    roleId: zod_1.z.string().uuid().optional(),
    branchIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
})
    .strict();
//# sourceMappingURL=user.validators.js.map