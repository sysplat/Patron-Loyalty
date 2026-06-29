import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Patron portal accessibility', () => {
  test('portal page has no critical axe violations', async ({ page }) => {
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
          patronName: 'A11y Patron',
          orgName: 'CI Cafe',
          pointsBalance: 250,
          pointsCurrencyName: 'Points',
          tier: { name: 'Silver' },
          rewards: [{ id: 'r1', name: 'Free coffee', pointsCost: 100 }],
          recentActivity: [],
        }),
      });
    });

    await page.goto('/portal/A11YPORT1');
    await expect(page.getByText('A11y Patron')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical, formatViolations(critical)).toEqual([]);
  });
});

function formatViolations(
  violations: Array<{ id: string; description: string; nodes: unknown[] }>,
): string {
  if (violations.length === 0) return '';
  return violations.map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`).join('\n');
}
