"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAppointmentsQuerySchema = exports.listUsersQuerySchema = exports.listTicketsQuerySchema = exports.optionalSearchQuery = exports.optionalUuidQuery = exports.paginationQuerySchema = void 0;
const zod_1 = require("zod");
const common_validators_1 = require("./common.validators");
const emptyToUndefined = (value) => value === '' || value === undefined || value === null ? undefined : value;
const optionalCoercedInt = (min, max) => zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce
    .number()
    .int()
    .min(min)
    .max(max ?? Number.MAX_SAFE_INTEGER)
    .optional());
exports.paginationQuerySchema = zod_1.z.object({
    page: optionalCoercedInt(1, 10_000),
    limit: optionalCoercedInt(1, 100),
});
exports.optionalUuidQuery = zod_1.z.preprocess(emptyToUndefined, common_validators_1.uuidSchema.optional());
exports.optionalSearchQuery = zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(200).optional());
exports.listTicketsQuerySchema = exports.paginationQuerySchema.extend({
    branchId: exports.optionalUuidQuery,
    queueId: exports.optionalUuidQuery,
    status: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(100).optional()),
    date: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(32).optional()),
    dateFrom: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(32).optional()),
    dateTo: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(32).optional()),
    search: exports.optionalSearchQuery,
    period: zod_1.z.preprocess(emptyToUndefined, zod_1.z.enum(['today', 'week']).optional()),
});
exports.listUsersQuerySchema = exports.paginationQuerySchema.extend({
    status: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(50).optional()),
    search: exports.optionalSearchQuery,
});
exports.listAppointmentsQuerySchema = exports.paginationQuerySchema.extend({
    branchId: exports.optionalUuidQuery,
    serviceId: exports.optionalUuidQuery,
    status: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(50).optional()),
    from: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(32).optional()),
    to: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(32).optional()),
    search: exports.optionalSearchQuery,
});
//# sourceMappingURL=query.validators.js.map