/**
 * Generate a URL-safe slug from a string.
 * Handles Unicode characters, multiple spaces, and special chars.
 */
export declare function generateSlug(input: string): string;
/**
 * Generate a unique slug by appending a random suffix.
 */
export declare function generateUniqueSlug(input: string): string;
/**
 * Generate a display number for a ticket (e.g., "A001", "B042").
 */
export declare function generateDisplayNumber(prefix: string, number: number): string;
/**
 * Generate a 6-character alphanumeric pairing code.
 * Uses uppercase letters and digits, excluding ambiguous chars (0/O, 1/I/L).
 */
export declare function generatePairingCode(): string;
//# sourceMappingURL=slug.d.ts.map