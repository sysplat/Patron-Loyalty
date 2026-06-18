"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderateReviewSchema = exports.createReviewSchema = void 0;
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
    branchId: zod_1.z.string().uuid().optional(),
    customerName: zod_1.z.string().min(1).max(100).trim(),
    customerEmail: zod_1.z.string().email().optional(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional(),
});
exports.moderateReviewSchema = zod_1.z.object({
    action: zod_1.z.enum(['approve', 'reject']),
});
//# sourceMappingURL=review.validators.js.map