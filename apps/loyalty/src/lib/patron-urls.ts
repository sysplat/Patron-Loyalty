/** Public patron URLs for invite links and QR codes (SRS §9). */
export function buildReferralInviteUrl(referralCode: string): string {
  const code = referralCode.toUpperCase();
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/refer/${encodeURIComponent(code)}`;
  }
  return `/refer/${encodeURIComponent(code)}`;
}

export function buildPatronPortalUrl(referralCode: string): string {
  const code = referralCode.toUpperCase();
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/portal/${encodeURIComponent(code)}`;
  }
  return `/portal/${encodeURIComponent(code)}`;
}

export function buildPatronCardUrl(referralCode: string): string {
  const code = referralCode.toUpperCase();
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/card/${encodeURIComponent(code)}`;
  }
  return `/card/${encodeURIComponent(code)}`;
}
