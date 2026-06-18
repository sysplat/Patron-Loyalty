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
export function normalizeCustomerDeskNumber(value: string | null | undefined): string | null {
  const digitsOnly = String(value ?? '').replace(/\D/g, '');
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return String(parsed);
}

/** Label for a numbered desk, e.g. "Desk 2". Same for customers and staff. */
export function formatCustomerDeskLabel(deskNumber: string | null | undefined): string | null {
  const normalized = normalizeCustomerDeskNumber(deskNumber);
  return normalized ? `Desk ${normalized}` : null;
}

/** Alias — staff serve UI uses the same label as customer surfaces. */
export const formatDeskLabel = formatCustomerDeskLabel;

/** Phrase for SMS/TTS: "Desk 2" or a neutral fallback. */
export function formatCustomerDeskPhrase(
  deskNumber: string | null | undefined,
  fallback = 'the service desk',
): string {
  return formatCustomerDeskLabel(deskNumber) ?? fallback;
}

/** Staff/customer label with fallback when number is missing. */
export function formatDeskLabelOrDefault(
  deskNumber: string | null | undefined,
  fallback = 'Desk',
): string {
  return formatCustomerDeskLabel(deskNumber) ?? fallback;
}
