import { test, expect } from '@playwright/test';

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('API health', () => {
  test('GET /api/v1/health returns ok', async ({ request }) => {
    const res = await request.get(`${apiBase}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
});
