"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupportRequestSchema = exports.reassignSupportContactSchema = exports.supportMessageSchema = exports.createSupportRequestSchema = void 0;
const zod_1 = require("zod");
exports.createSupportRequestSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1).max(200).trim(),
    message: zod_1.z.string().min(1).max(10000),
    priority: zod_1.z.enum(['low', 'normal', 'high']).optional(),
    category: zod_1.z.string().max(50).optional(),
});
exports.supportMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(10000),
    /** Platform-operator internal note (platform admin API only). */
    isInternal: zod_1.z.boolean().optional(),
    /** Org-only note; not sent to QlessQ support. */
    isOrgInternal: zod_1.z.boolean().optional(),
});
exports.reassignSupportContactSchema = zod_1.z.object({
    contactUserId: zod_1.z.string().uuid(),
});
exports.updateSupportRequestSchema = zod_1.z.object({
    status: zod_1.z.string().max(50).optional(),
    priority: zod_1.z.string().max(50).optional(),
    category: zod_1.z.string().max(50).optional(),
    assignedToUserId: zod_1.z.string().uuid().nullable().optional(),
});
//# sourceMappingURL=support.validators.js.map