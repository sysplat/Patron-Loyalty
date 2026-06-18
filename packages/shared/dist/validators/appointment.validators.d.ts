import { z } from 'zod';
export declare const bookAppointmentBaseSchema: z.ZodObject<{
    branchId: z.ZodString;
    serviceId: z.ZodString;
    subServiceId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodString;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    scheduledAt: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}>;
export declare const bookAppointmentSchema: z.ZodEffects<z.ZodObject<{
    branchId: z.ZodString;
    serviceId: z.ZodString;
    subServiceId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodString;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    scheduledAt: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}>, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}, {
    branchId: string;
    serviceId: string;
    customerName: string;
    scheduledAt: string;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    subServiceId?: string | undefined;
    notes?: string | undefined;
}>;
export declare const updateAppointmentSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    assignedUserId: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    notes?: string | undefined;
    assignedUserId?: string | undefined;
}, {
    status?: string | undefined;
    notes?: string | undefined;
    assignedUserId?: string | undefined;
}>;
//# sourceMappingURL=appointment.validators.d.ts.map