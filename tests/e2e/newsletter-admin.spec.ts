import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Newsletter-Verwaltung', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Kampagne anlegen und Protokoll öffnen', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/admin/login/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/newsletter/');
    await expect(page.getByRole('heading', { name: 'Newsletter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Empfänger' })).toBeVisible();

    await page.fill('input[name="subject"]', `E2E Newsletter ${Date.now()}`);
    await page.fill('textarea[name="text"]', 'Das ist ein Test-Newsletter.');
    await page.locator('form[action="/admin/newsletter/kampagne/"] button[type="submit"]').click();
    await expect(page).toHaveURL(/gespeichert=1/);

    const row = page.locator('table tbody tr').filter({ hasText: 'E2E Newsletter' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'Protokoll' }).click();
    await expect(page.getByRole('heading', { name: /Versandprotokoll/ })).toBeVisible();
  });
});
