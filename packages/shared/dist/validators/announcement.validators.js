"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAnnouncementSchema = exports.createAnnouncementSchema = void 0;
const zod_1 = require("zod");
const datetime_1 = require("./datetime");
exports.createAnnouncementSchema = zod_1.z.object({
    deliveryMode: zod_1.z.enum(['banner', 'modal', 'blocking']).optional().default('banner'),
    dismissBehavior: zod_1.z.enum(['allowed', 'disallowed']).optional().default('allowed'),
    requireAcknowledgment: zod_1.z.boolean().optional().default(false),
    branchId: zod_1.z.string().uuid().optional(),
    message: zod_1.z.string().min(1).max(500),
    type: zod_1.z.string().max(50).optional().default('info'),
    displayOnScreen: zod_1.z.boolean().optional().default(false),
    activeFrom: datetime_1.optionalDateTimeString,
    activeUntil: datetime_1.optionalDateTimeString,
});
exports.updateAnnouncementSchema = zod_1.z.object({
    deliveryMode: zod_1.z.enum(['banner', 'modal', 'blocking']).optional(),
    dismissBehavior: zod_1.z.enum(['allowed', 'disallowed']).optional(),
    requireAcknowledgment: zod_1.z.boolean().optional(),
    message: zod_1.z.string().max(500).optional(),
    type: zod_1.z.string().max(50).optional(),
    displayOnScreen: zod_1.z.boolean().optional(),
    activeFrom: datetime_1.nullableOptionalDateTimeString,
    activeUntil: datetime_1.nullableOptionalDateTimeString,
});
//# sourceMappingURL=announcement.validators.js.map