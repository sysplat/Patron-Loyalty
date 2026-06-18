"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nullableOptionalDateTimeString = exports.optionalDateTimeString = exports.dateTimeString = void 0;
exports.isParseableDateTimeString = isParseableDateTimeString;
const zod_1 = require("zod");
/** True when `Date.parse` accepts the value (ISO, datetime-local, date-only, etc.). */
function isParseableDateTimeString(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    return !Number.isNaN(Date.parse(trimmed));
}
/**
 * Lenient date/time string for API inputs from browsers (`datetime-local`, date-only)
 * and full ISO-8601. Stricter than accepting any string, looser than `z.string().datetime()`.
 */
exports.dateTimeString = zod_1.z
    .string()
    .trim()
    .refine(isParseableDateTimeString, { message: 'Invalid date/time' });
exports.optionalDateTimeString = exports.dateTimeString.optional();
exports.nullableOptionalDateTimeString = zod_1.z.union([exports.dateTimeString, zod_1.z.null()]).optional();
//# sourceMappingURL=datetime.js.map