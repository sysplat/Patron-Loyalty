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

test.describe('Staff rewards catalog', () => {
  test.skip(
    !smokeEmail || !smokePassword,
    'requires LOYALTY_SMOKE_EMAIL and LOYALTY_SMOKE_PASSWORD',
  );

  test('creates a new reward from catalog page', async ({ page }) => {
    const rewardName = `E2E Reward ${Date.now()}`;

    await page.route('**/loyalty/rewards**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { name: string };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'reward-e2e-1',
            name: body.name,
            pointsCost: 100,
            type: 'DISCOUNT',
            active: true,
            stock: null,
          }),
        });
        return;
      }
      await route.continue();
    });

    await signIn(page);
    await page.goto('/rewards');

    await page.getByLabel(/name/i).fill(rewardName);
    await page.getByLabel(/points/i).fill('100');
    await page.getByRole('button', { name: /create|add reward/i }).click();

    await expect(page.getByText(rewardName)).toBeVisible({ timeout: 10_000 });
  });
});
