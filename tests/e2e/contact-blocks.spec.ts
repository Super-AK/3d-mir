import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Absender-Verwaltung', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Beobachteten Absender sperren, aufheben und löschen', async ({ page }) => {
    await page.goto('/admin/login/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/nachrichten/');
    const row = page.locator('tr[id^="absender-"]').filter({ hasText: '198.51.100.0/24' }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('beobachtet');

    await row.getByRole('button', { name: /manuell sperren/ }).click();
    await expect(page).toHaveURL(/gespeichert=1/);
    await page.goto('/admin/nachrichten/');
    await expect(row).toContainText('gesperrt');

    await row.getByRole('button', { name: /Sperre .* aufheben/ }).click();
    await expect(page).toHaveURL(/gespeichert=1/);
    await page.goto('/admin/nachrichten/');
    await expect(row).toContainText('beobachtet');

    await row.getByRole('button', { name: /Eintrag .* löschen/ }).click();
    await expect(page).toHaveURL(/geloescht=1/);
    await page.goto('/admin/nachrichten/');
    await expect(row).toHaveCount(0);
  });
});
