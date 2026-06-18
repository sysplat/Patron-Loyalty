// ─── Slug utilities ──────────────────────────────

/**
 * Generate a URL-safe slug from a string.
 * Handles Unicode characters, multiple spaces, and special chars.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug by appending a random suffix.
 */
export function generateUniqueSlug(input: string): string {
  const base = generateSlug(input);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

/**
 * Generate a display number for a ticket (e.g., "A001", "B042").
 */
export function generateDisplayNumber(prefix: string, number: number): string {
  return `${prefix}${number.toString().padStart(3, '0')}`;
}

/**
 * Generate a 6-character alphanumeric pairing code.
 * Uses uppercase letters and digits, excluding ambiguous chars (0/O, 1/I/L).
 */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
