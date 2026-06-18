/**
 * Normalizes a phone number for SMS providers.
 *
 * The platform sends SMS through provider APIs that require E.164 recipients.
 * US/Canada 10-digit local numbers are normalized to +1 for kiosk and staff
 * entry convenience; all other international numbers must include +country code.
 */
export function normalizeSmsRecipient(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/[\s().-]/g, '');
  const withPlusPrefix = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  let normalized = withPlusPrefix;
  if (!normalized.startsWith('+')) {
    if (/^1\d{10}$/.test(normalized)) {
      normalized = `+${normalized}`;
    } else if (/^\d{10}$/.test(normalized)) {
      normalized = `+1${normalized}`;
    } else {
      return null;
    }
  }

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
