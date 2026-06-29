import { test, expect } from '@playwright/test';

const smokeEmail = process.env.LOYALTY_SMOKE_EMAIL;
const smokePassword = process.env.LOYALTY_SMOKE_PASSWORD;

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(smokeEmail!);
  await page.getByLabel(/password/i).fill(smokePassword!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
}

test.describe('Loyalty integrations API key UI', () => {
  test.skip(
    !smokeEmail || !smokePassword,
    'requires LOYALTY_SMOKE_EMAIL and LOYALTY_SMOKE_PASSWORD',
  );

  test('shows stale key warning when lastUsedAt is older than 30 days', async ({ page }) => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 45);

    await page.route('**/loyalty/integrations/api-key**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          prefix: 'lms_stale01',
          createdAt: '2025-06-01T00:00:00.000Z',
          lastUsedAt: staleDate.toISOString(),
        }),
      });
    });

    await signIn(page);
    await page.goto('/integrations');

    await expect(page.getByText(/Last used:/)).toBeVisible();
    await expect(page.getByText(/No connector traffic in 30\+ days/)).toBeVisible();
    await expect(page.getByText(/verify QlessQ or POS config/)).toBeVisible();
  });

  test('shows never used when lastUsedAt is null', async ({ page }) => {
    await page.route('**/loyalty/integrations/api-key**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          prefix: 'lms_newkey01',
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        }),
      });
    });

    await signIn(page);
    await page.goto('/integrations');

    await expect(page.getByText(/Last used:/)).toBeVisible();
    await expect(page.getByText('Never used')).toBeVisible();
    await expect(page.getByText(/No connector traffic in 30\+ days/)).toBeVisible();
  });

  test('reveals new API key after rotate', async ({ page }) => {
    const newKey = 'lms_e2e_rotate_key_01';

    await page.route('**/loyalty/integrations/api-key**', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET' && !url.includes('rotate')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            configured: false,
            prefix: null,
            createdAt: null,
            lastUsedAt: null,
          }),
        });
        return;
      }
      if (route.request().method() === 'POST' && url.includes('rotate')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ apiKey: newKey, prefix: 'lms_e2e01' }),
        });
        return;
      }
      await route.continue();
    });

    await signIn(page);
    await page.goto('/integrations');
    await page.getByRole('button', { name: /Generate key|Rotate key/i }).click();
    await expect(page.getByText(newKey)).toBeVisible();
  });
});
