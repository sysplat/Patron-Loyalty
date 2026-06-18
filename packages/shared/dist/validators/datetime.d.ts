import { z } from 'zod';
/** True when `Date.parse` accepts the value (ISO, datetime-local, date-only, etc.). */
export declare function isParseableDateTimeString(value: string): boolean;
/**
 * Lenient date/time string for API inputs from browsers (`datetime-local`, date-only)
 * and full ISO-8601. Stricter than accepting any string, looser than `z.string().datetime()`.
 */
export declare const dateTimeString: z.ZodEffects<z.ZodString, string, string>;
export declare const optionalDateTimeString: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
export declare const nullableOptionalDateTimeString: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodNull]>>;
//# sourceMappingURL=datetime.d.ts.map