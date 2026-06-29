import { test, expect } from '@playwright/test';

const smokeEmail = process.env.LOYALTY_SMOKE_EMAIL;
const smokePassword = process.env.LOYALTY_SMOKE_PASSWORD;

test.describe('Loyalty staff dashboard', () => {
  test.skip(
    !smokeEmail || !smokePassword,
    'requires LOYALTY_SMOKE_EMAIL and LOYALTY_SMOKE_PASSWORD',
  );

  test('overview and integrations nav are reachable after sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(smokeEmail!);
    await page.getByLabel(/password/i).fill(smokePassword!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });

    await page.goto('/integrations');
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible();
    await expect(page.getByText(/API key/i)).toBeVisible();
  });
});
