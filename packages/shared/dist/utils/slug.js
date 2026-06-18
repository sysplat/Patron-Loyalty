"use strict";
// ─── Slug utilities ──────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = generateSlug;
exports.generateUniqueSlug = generateUniqueSlug;
exports.generateDisplayNumber = generateDisplayNumber;
exports.generatePairingCode = generatePairingCode;
/**
 * Generate a URL-safe slug from a string.
 * Handles Unicode characters, multiple spaces, and special chars.
 */
function generateSlug(input) {
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
function generateUniqueSlug(input) {
    const base = generateSlug(input);
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
}
/**
 * Generate a display number for a ticket (e.g., "A001", "B042").
 */
function generateDisplayNumber(prefix, number) {
    return `${prefix}${number.toString().padStart(3, '0')}`;
}
/**
 * Generate a 6-character alphanumeric pairing code.
 * Uses uppercase letters and digits, excluding ambiguous chars (0/O, 1/I/L).
 */
function generatePairingCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
//# sourceMappingURL=slug.js.map