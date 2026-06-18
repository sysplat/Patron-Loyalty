import { z } from 'zod';
export declare const createReviewSchema: z.ZodObject<{
    orgId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodString;
    customerEmail: z.ZodOptional<z.ZodString>;
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    customerName: string;
    rating: number;
    branchId?: string | undefined;
    customerEmail?: string | undefined;
    comment?: string | undefined;
}, {
    orgId: string;
    customerName: string;
    rating: number;
    branchId?: string | undefined;
    customerEmail?: string | undefined;
    comment?: string | undefined;
}>;
export declare const moderateReviewSchema: z.ZodObject<{
    action: z.ZodEnum<["approve", "reject"]>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
}, {
    action: "approve" | "reject";
}>;
//# sourceMappingURL=review.validators.d.ts.map