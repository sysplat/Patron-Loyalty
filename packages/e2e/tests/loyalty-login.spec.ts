import { test, expect } from '@playwright/test';

test.describe('Loyalty login smoke', () => {
  test('login page loads', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login/);
  });
});

const smokeEmail = process.env.LOYALTY_SMOKE_EMAIL;
const smokePassword = process.env.LOYALTY_SMOKE_PASSWORD;

test.describe('Loyalty session smoke', () => {
  test.skip(
    !smokeEmail || !smokePassword,
    'requires LOYALTY_SMOKE_EMAIL and LOYALTY_SMOKE_PASSWORD',
  );

  test('staff can sign in and reach overview', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(smokeEmail!);
    await page.getByLabel(/password/i).fill(smokePassword!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
  });
});
