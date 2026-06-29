import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Loyalty login accessibility', () => {
  test('login page has no critical axe violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();

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
