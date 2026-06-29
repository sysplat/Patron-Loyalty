import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const smokeEmail = process.env.LOYALTY_SMOKE_EMAIL;
const smokePassword = process.env.LOYALTY_SMOKE_PASSWORD;

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(smokeEmail!);
  await page.getByLabel(/password/i).fill(smokePassword!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
}

test.describe('Loyalty overview accessibility', () => {
  test.skip(
    !smokeEmail || !smokePassword,
    'requires LOYALTY_SMOKE_EMAIL and LOYALTY_SMOKE_PASSWORD',
  );

  test('overview dashboard has no critical axe violations', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('main').or(page.locator('body'))).toBeVisible();

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
