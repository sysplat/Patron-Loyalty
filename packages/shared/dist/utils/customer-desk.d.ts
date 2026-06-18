/**
 * Desk terminology for customer- and staff-facing copy.
 *
 * Policy (QlessQ):
 * - **Desk** — numbered physical service point (`Desk` model, `deskNumber`). Use in all
 *   product UI, SMS, track, lobby display, and staff admin ("Branch desks", "Desk 2").
 * - **Station** — workbench session template only (`StationProfile`, capabilities). Never
 *   customer-facing; a desk is where the agent sits, a station profile is what they can do.
 * - **Counter** — avoid in product UI. Reserved for industry examples ("pharmacy counter")
 *   and legacy notification template variable `counterNumber` (alias of `deskNumber`).
 *
 * Unrelated: queue "session counter" = ticket sequence, not a service point.
 */
/** Normalize a desk number for display (digits only, min 1). */
export declare function normalizeCustomerDeskNumber(value: string | null | undefined): string | null;
/** Label for a numbered desk, e.g. "Desk 2". Same for customers and staff. */
export declare function formatCustomerDeskLabel(deskNumber: string | null | undefined): string | null;
/** Alias — staff serve UI uses the same label as customer surfaces. */
export declare const formatDeskLabel: typeof formatCustomerDeskLabel;
/** Phrase for SMS/TTS: "Desk 2" or a neutral fallback. */
export declare function formatCustomerDeskPhrase(deskNumber: string | null | undefined, fallback?: string): string;
/** Staff/customer label with fallback when number is missing. */
export declare function formatDeskLabelOrDefault(deskNumber: string | null | undefined, fallback?: string): string;
//# sourceMappingURL=customer-desk.d.ts.map