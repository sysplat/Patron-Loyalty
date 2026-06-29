import { test, expect } from '@playwright/test';

const PORTAL_CODE = 'PROFILETEST';

test.describe('Patron portal profile update', () => {
  test('saves birthday profile field', async ({ page }) => {
    let profileBody: Record<string, unknown> | null = null;

    await page.route('**/loyalty/public/portal/**', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET') {
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
      if (route.request().method() === 'PATCH' && url.includes('/profile')) {
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

    await page.getByLabel(/birthday/i).fill('1990-05-15');
    await page.getByRole('button', { name: /save profile|update profile|save/i }).click();

    await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 10_000 });
    expect(profileBody).toMatchObject({ birthday: '1990-05-15' });
  });
});
