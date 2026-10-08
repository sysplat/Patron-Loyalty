import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.spec.tsx'],
    passWithNoTests: false,
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
