import { z } from 'zod';
export declare const createAnnouncementSchema: z.ZodObject<{
    deliveryMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["banner", "modal", "blocking"]>>>;
    dismissBehavior: z.ZodDefault<z.ZodOptional<z.ZodEnum<["allowed", "disallowed"]>>>;
    requireAcknowledgment: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    branchId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    displayOnScreen: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    activeFrom: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    activeUntil: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: string;
    deliveryMode: "banner" | "modal" | "blocking";
    dismissBehavior: "allowed" | "disallowed";
    requireAcknowledgment: boolean;
    displayOnScreen: boolean;
    branchId?: string | undefined;
    activeFrom?: string | undefined;
    activeUntil?: string | undefined;
}, {
    message: string;
    branchId?: string | undefined;
    type?: string | undefined;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
    displayOnScreen?: boolean | undefined;
    activeFrom?: string | undefined;
    activeUntil?: string | undefined;
}>;
export declare const updateAnnouncementSchema: z.ZodObject<{
    deliveryMode: z.ZodOptional<z.ZodEnum<["banner", "modal", "blocking"]>>;
    dismissBehavior: z.ZodOptional<z.ZodEnum<["allowed", "disallowed"]>>;
    requireAcknowledgment: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    displayOnScreen: z.ZodOptional<z.ZodBoolean>;
    activeFrom: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodNull]>>;
    activeUntil: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodNull]>>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    type?: string | undefined;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
    displayOnScreen?: boolean | undefined;
    activeFrom?: string | null | undefined;
    activeUntil?: string | null | undefined;
}, {
    message?: string | undefined;
    type?: string | undefined;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
    displayOnScreen?: boolean | undefined;
    activeFrom?: string | null | undefined;
    activeUntil?: string | null | undefined;
}>;
//# sourceMappingURL=announcement.validators.d.ts.map