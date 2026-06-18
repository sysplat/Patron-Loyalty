import { z } from 'zod';
export declare const uploadMetadataSchema: z.ZodObject<{
    entityType: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entityType?: string | undefined;
    entityId?: string | undefined;
}, {
    entityType?: string | undefined;
    entityId?: string | undefined;
}>;
//# sourceMappingURL=upload.validators.d.ts.map