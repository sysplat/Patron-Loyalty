/**
 * Normalizes a phone number for SMS providers.
 *
 * The platform sends SMS through provider APIs that require E.164 recipients.
 * US/Canada 10-digit local numbers are normalized to +1 for kiosk and staff
 * entry convenience; all other international numbers must include +country code.
 */
export declare function normalizeSmsRecipient(phone: string): string | null;
//# sourceMappingURL=phone.d.ts.map