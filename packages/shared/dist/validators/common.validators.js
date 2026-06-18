"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.journeyModeSchema = exports.stepRoleSchema = exports.callingPolicySchema = exports.ticketSourceSchema = exports.deskNumberSchema = exports.uuidSchema = exports.centrifugoWebhookSchema = exports.jsonRecordSchema = void 0;
const zod_1 = require("zod");
/** Loose JSON object for partial update endpoints that accept arbitrary keys. */
exports.jsonRecordSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
/** Centrifugo proxy webhook payload (connect / disconnect / etc.). */
exports.centrifugoWebhookSchema = zod_1.z
    .object({
    method: zod_1.z.string(),
    params: zod_1.z.record(zod_1.z.unknown()).optional(),
})
    .passthrough();
exports.uuidSchema = zod_1.z.string().uuid();
exports.deskNumberSchema = zod_1.z.string().min(1).max(20);
exports.ticketSourceSchema = zod_1.z.enum(['walk_in', 'online', 'kiosk', 'staff', 'public']);
exports.callingPolicySchema = zod_1.z.enum([
    'fifo',
    'manual_only',
    'ready_then_manual',
    'ready_then_fifo',
]);
exports.stepRoleSchema = zod_1.z.enum(['service', 'pickup']);
exports.journeyModeSchema = zod_1.z.enum(['single_ticket', 'visit_multi_step']);
//# sourceMappingURL=common.validators.js.map