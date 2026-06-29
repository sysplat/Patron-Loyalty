import { test, expect } from '@playwright/test';

test.describe('Patron portal offline UX', () => {
  test('shows offline banner when browser is offline', async ({ page, context }) => {
    await page.route('**/loyalty/public/portal/**', async (route) => {
      if (route.request().method() !== 'GET' || route.request().url().includes('/redeem')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          found: true,
          legalConsentGranted: true,
          patronName: 'Offline Patron',
          orgName: 'CI Cafe',
          pointsBalance: 100,
          pointsCurrencyName: 'Points',
          tier: { name: 'Gold' },
          rewards: [],
          recentActivity: [],
        }),
      });
    });

    await page.goto('/portal/OFFLINE01');
    await expect(page.getByText('Offline Patron')).toBeVisible({ timeout: 15_000 });

    await context.setOffline(true);
    await expect(page.getByRole('status')).toContainText(/offline/i);
  });
});
