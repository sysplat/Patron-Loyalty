import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/** Loyalty module coverage gate (Phase 3). Ratchet thresholds as specs grow. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/modules/loyalty/**/*.spec.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      include: ['src/modules/loyalty/**/*.ts'],
      exclude: [
        'src/modules/loyalty/**/*.spec.ts',
        'src/modules/loyalty/**/*.module.ts',
        'src/modules/loyalty/loyalty.events.ts',
      ],
      // Ratchet +1–2% when adding loyalty unit specs (istanbul provider).
      thresholds: {
        lines: 34,
        functions: 25,
        branches: 29,
        statements: 34,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
