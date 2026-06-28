import { defineConfig, devices } from '@playwright/test';

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
const loyaltyBase = process.env.LOYALTY_BASE_URL ?? 'http://localhost:3003';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testMatch: /api-health\.spec\.ts/,
    },
    {
      name: 'loyalty',
      testMatch: /loyalty-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: loyaltyBase,
      },
    },
  ],
  metadata: {
    apiBase,
    loyaltyBase,
  },
});
