import { expect, test } from '@playwright/test';

const email = process.env.E2E_SUPPORT_EMAIL ?? '';
const password = process.env.E2E_SUPPORT_PASSWORD ?? '';

test.describe('Support-Rolle', () => {
  test.skip(!email || !password, 'E2E_SUPPORT_EMAIL/E2E_SUPPORT_PASSWORD nicht gesetzt');

  test('lesen erlaubt, Schreiben und Export verboten', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/admin/login/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/kunden/');
    await expect(page.getByRole('heading', { name: 'Kunden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CSV-Export' })).toHaveCount(0);

    const csrf = await page.locator('input[name="_csrf"]').first().inputValue();
    const exportResponse = await page.request.post('/admin/kunden/export/', {
      form: { _csrf: csrf },
      headers: { origin: 'http://127.0.0.1' },
    });
    expect(exportResponse.status()).toBe(403);

    await page.goto('/admin/kunden/');
    const link = page.locator('table a[href^="/admin/kunden/"]').first();
    if (await link.count()) {
      await link.click();
      await expect(page.getByRole('heading', { name: 'Interne Notiz' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Status und Aktionen' })).toHaveCount(0);
    }
  });
});
