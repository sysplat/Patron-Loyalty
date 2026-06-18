"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const slug_1 = require("./slug");
(0, vitest_1.describe)('generateSlug', () => {
    (0, vitest_1.it)('converts a business name to a lowercase slug', () => {
        (0, vitest_1.expect)((0, slug_1.generateSlug)('My Awesome Business')).toBe('my-awesome-business');
    });
    (0, vitest_1.it)('removes special characters', () => {
        (0, vitest_1.expect)((0, slug_1.generateSlug)('Hello World! @#$%')).toBe('hello-world');
    });
    (0, vitest_1.it)('trims leading and trailing hyphens', () => {
        (0, vitest_1.expect)((0, slug_1.generateSlug)('  spaced out  ')).toBe('spaced-out');
    });
    (0, vitest_1.it)('handles empty string', () => {
        (0, vitest_1.expect)((0, slug_1.generateSlug)('')).toBe('');
    });
});
//# sourceMappingURL=slug.spec.js.map