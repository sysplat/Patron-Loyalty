import { test, expect } from '@playwright/test';

const PORTAL_CODE = 'REDEEMTEST';

test.describe('Patron portal redeem flow', () => {
  test('redeems reward after legal consent', async ({ page }) => {
    await page.route('**/loyalty/public/portal/**', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET' && !url.includes('/redeem')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            found: true,
            legalConsentGranted: false,
            patronName: 'Redeem Patron',
            orgName: 'CI Cafe',
            pointsBalance: 250,
            pointsCurrencyName: 'Points',
            tier: { name: 'Silver' },
            rewards: [{ id: 'reward-1', name: 'Free coffee', pointsCost: 100 }],
            recentActivity: [],
          }),
        });
        return;
      }
      if (route.request().method() === 'POST' && url.includes('/redeem')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, redemptionId: 'red-1' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/portal/${PORTAL_CODE}`);
    await expect(page.getByText('Redeem Patron')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('checkbox', { name: /terms|privacy|consent/i }).check();
    await page
      .getByRole('button', { name: /Redeem|Claim/i })
      .first()
      .click();

    await expect(page.getByText(/redeemed|success/i)).toBeVisible({ timeout: 10_000 });
  });
});
