import { expect, test } from '@playwright/test';

/**
 * Admin-Tests laufen nur, wenn Zugangsdaten über die Umgebung gesetzt sind.
 * So landen keine Passwörter im Repository und die Tests brechen auf
 * Installationen ohne Testkonto nicht ab.
 *
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('Admin', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Login, geschützte Seiten und Logout', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/admin/');
    await expect(page).toHaveURL(/\/admin\/login\//);

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page).toHaveURL(/\/admin\/$/);
    await expect(page.locator('h1')).toHaveText('Dashboard');

    for (const [path, heading] of [
      ['/admin/bestellungen/', 'Bestellungen'],
      ['/admin/anfragen/', 'Anfragen'],
      ['/admin/nachrichten/', 'Nachrichten'],
      ['/admin/produkte/', 'Produkte'],
      ['/admin/preise/', 'Preise und Kalkulation'],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toContainText(heading);
    }

    // Katalogverwaltung und Bild-Upload sind auf den Detailseiten vorhanden.
    await page.goto('/admin/preise/');
    for (const heading of ['Materialien', 'Drucker', 'Nachbearbeitung', 'Versand', 'Mengenrabatt']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await page.goto('/admin/produkte/');
    await page.locator('table tbody tr a').first().click();
    await expect(page.getByRole('heading', { name: 'Bilder', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bild hinzufügen', exact: true })).toBeVisible();
    await expect(page.locator('#image_file')).toHaveAttribute('multiple', '');

    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/login\/\?abgemeldet=1/);

    const response = await page.goto('/admin/bestellungen/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/login\//);

    expect(errors).toEqual([]);
  });
});
