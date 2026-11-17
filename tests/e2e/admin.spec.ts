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
    test.setTimeout(90_000);
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
      ['/admin/stammdaten/', 'Stammdaten'],
      ['/admin/bestellungen/', 'Bestellungen'],
      ['/admin/anfragen/', 'Anfragen'],
      ['/admin/nachrichten/', 'Nachrichten'],
      ['/admin/produkte/', 'Produkte'],
      ['/admin/kategorien/', 'Kategorien'],
      ['/admin/preise/', 'Preise und Kalkulation'],
      ['/admin/zahlungen/', 'Zahlungen'],
      ['/admin/veroeffentlichung/', 'Veröffentlichung'],
      ['/admin/benachrichtigungen/', 'Benachrichtigungen'],
      ['/admin/testdaten/', 'Testdaten zurücksetzen'],
      ['/admin/produkte/etsy/', 'Produkte aus Etsy importieren'],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toContainText(heading);
    }

    // Live-Suche in der Bestellliste: tippen aktualisiert die Ergebnisse,
    // ohne die Seite neu zu laden (der Fokus bleibt im Suchfeld).
    await page.goto('/admin/bestellungen/');
    await expect(page.getByRole('button', { name: 'Filtern', exact: true })).toBeHidden();
    const search = page.locator('#q');
    await search.fill('zzz-kein-treffer');
    await expect(page.locator('[data-filter-results]')).toContainText('Keine Bestellungen gefunden');
    await expect(page).toHaveURL(/[?&]q=zzz-kein-treffer/);
    await expect(search).toBeFocused();

    // Stripe-Hilfe auf der Zahlungsseite ist aufklappbar.
    await page.goto('/admin/zahlungen/');
    const stripeHelp = page.locator('summary', { hasText: 'Hilfe zu Stripe' });
    await expect(stripeHelp).toBeVisible();
    await stripeHelp.click();
    await expect(page.getByRole('heading', { name: '3. Webhook anlegen' })).toBeVisible();

    // Benachrichtigungen: Kanalwahl und Testaktionen.
    await page.goto('/admin/benachrichtigungen/');
    await expect(page.locator('input[name="channel"]')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Test-E-Mail senden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test-Telegram senden' })).toBeVisible();

    // Katalogverwaltung und Bild-Upload sind auf den Detailseiten vorhanden.
    await page.goto('/admin/preise/');
    for (const heading of ['Materialien', 'Drucker', 'Nachbearbeitung', 'Versand', 'Mengenrabatt']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await page.goto('/admin/produkte/');
    await expect(page.getByRole('link', { name: 'Importieren', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Exportieren' })).toBeVisible();
    await expect(page.locator('[data-select-product]').first()).toBeVisible();
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
