/** For public track URLs: show last 4 digits only (caller must hold opaque ticket id). */
export function maskCustomerPhoneE164(phone: string | null | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  const last4 = digits.slice(-4);
  return `*******${last4}`;
}

export function maskCustomerName(name: string | null | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  return name
    .split(/\s+/)
    .map((part) =>
      part.length > 0 ? part.charAt(0) + '*'.repeat(Math.max(1, part.length - 1)) : '',
    )
    .join(' ');
}
