import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Bot-Schutz Admin', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Status und Ereignisprotokoll sind sichtbar', async ({ page }) => {
    await page.goto('/admin/login/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/bot-schutz/');
    await expect(page.getByRole('heading', { name: 'Bot-Schutz' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Konfiguration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ereignisse' })).toBeVisible();
    await expect(page.getByText('3 Anfragen pro Stunde und IP')).toBeVisible();

    await page.fill('input[name="siteKey"]', '1x00000000000000000000BB');
    await page.fill('input[name="secret"]', '1x0000000000000000000000000000000AA');
    await page.getByRole('button', { name: 'Keys speichern' }).click();
    await expect(page).toHaveURL(/gespeichert=1/);
    await expect(page.locator('dl').first()).toContainText('aktiv');

    await page.getByRole('button', { name: 'Auf Umgebungsvariablen zurücksetzen' }).click();
    await expect(page).toHaveURL(/zurueckgesetzt=1/);
  });
});
