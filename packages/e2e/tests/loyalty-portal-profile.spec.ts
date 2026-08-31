import { test, expect } from '@playwright/test';

const PORTAL_CODE = 'PROFILETEST';

test.describe('Patron portal profile update', () => {
  test('saves birthday after phone OTP unlock', async ({ page }) => {
    let profileBody: Record<string, unknown> | null = null;
    let profileAuth: string | null = null;

    await page.route('**/loyalty/public/portal/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            found: true,
            legalConsentGranted: true,
            patronName: 'Profile Patron',
            orgName: 'CI Cafe',
            pointsBalance: 100,
            birthday: null,
            rewards: [],
            recentActivity: [],
          }),
        });
        return;
      }

      if (method === 'POST' && url.includes('/otp/request')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, phoneMasked: '***9999' }),
        });
        return;
      }

      if (method === 'POST' && url.includes('/otp/verify')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ accessToken: 'test-portal-token', expiresIn: 1800 }),
        });
        return;
      }

      if (method === 'PATCH' && url.includes('/profile')) {
        profileAuth = route.request().headers()['authorization'] ?? null;
        profileBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, birthday: '1990-05-15' }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(`/portal/${PORTAL_CODE}`);
    await expect(page.getByText('Profile Patron')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Send code/i }).click();
    await page.getByPlaceholder('6-digit code').fill('123456');
    await page.getByRole('button', { name: /^Verify$/i }).click();
    await expect(page.getByText(/Phone verified/i)).toBeVisible();

    await page.getByLabel(/birthday/i).fill('1990-05-15');
    await page.getByRole('button', { name: /save profile|update profile|save/i }).click();

    await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 10_000 });
    expect(profileAuth).toMatch(/^Bearer /);
    expect(profileBody).toMatchObject({ birthday: '1990-05-15' });
  });
});
