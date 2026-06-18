"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDeskLabel = void 0;
exports.normalizeCustomerDeskNumber = normalizeCustomerDeskNumber;
exports.formatCustomerDeskLabel = formatCustomerDeskLabel;
exports.formatCustomerDeskPhrase = formatCustomerDeskPhrase;
exports.formatDeskLabelOrDefault = formatDeskLabelOrDefault;
/** Normalize a desk number for display (digits only, min 1). */
function normalizeCustomerDeskNumber(value) {
    const digitsOnly = String(value ?? '').replace(/\D/g, '');
    if (!digitsOnly)
        return null;
    const parsed = Number.parseInt(digitsOnly, 10);
    if (!Number.isFinite(parsed) || parsed < 1)
        return null;
    return String(parsed);
}
/** Label for a numbered desk, e.g. "Desk 2". Same for customers and staff. */
function formatCustomerDeskLabel(deskNumber) {
    const normalized = normalizeCustomerDeskNumber(deskNumber);
    return normalized ? `Desk ${normalized}` : null;
}
/** Alias — staff serve UI uses the same label as customer surfaces. */
exports.formatDeskLabel = formatCustomerDeskLabel;
/** Phrase for SMS/TTS: "Desk 2" or a neutral fallback. */
function formatCustomerDeskPhrase(deskNumber, fallback = 'the service desk') {
    return formatCustomerDeskLabel(deskNumber) ?? fallback;
}
/** Staff/customer label with fallback when number is missing. */
function formatDeskLabelOrDefault(deskNumber, fallback = 'Desk') {
    return formatCustomerDeskLabel(deskNumber) ?? fallback;
}
//# sourceMappingURL=customer-desk.js.map