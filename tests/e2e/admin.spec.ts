import { readFileSync } from 'node:fs';
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
    await expect(page.getByText('Besucher der letzten 7 Tage')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub Actions' })).toBeVisible();
    await expect(page.getByText('Letzter Workflow-Lauf des CI-Workflows für')).toBeVisible();
    await expect(page.getByText('1.0.0-rc.64')).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).not.toHaveCount(0);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/site\.webmanifest/);
    for (const name of ['dashboard-visitors', 'dashboard-monitor']) {
      await expect(page.locator(`[data-collapse="${name}"]`)).not.toHaveAttribute('open', '');
    }

    for (const [path, heading] of [
      ['/admin/stammdaten/', 'Stammdaten'],
      ['/admin/bestellungen/', 'Bestellungen'],
      ['/admin/anfragen/', 'Anfragen'],
      ['/admin/nachrichten/', 'Nachrichten'],
      ['/admin/besucherstatistik/', 'Besucherstatistik'],
      ['/admin/produkte/', 'Produkte'],
      ['/admin/produkte/csv/import/', 'Produkte aus CSV importieren'],
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

    // Nachrichten: Spam-Sperre mit 404-Antwort und Statistik.
    await page.goto('/admin/nachrichten/');
    await expect(page.getByRole('heading', { name: 'Spam-Sperren: 404-Antworten' })).toBeVisible();
    const spamSettings = page.locator('details.admin-contact-settings');
    await expect(spamSettings).toBeVisible();
    await spamSettings.locator('summary').click();
    const spamBlockResponseToggle = page.locator('input[name="spamBlockResponseEnabled"]');
    await expect(spamBlockResponseToggle).toBeVisible();
    await expect(spamBlockResponseToggle).toBeChecked();

    // Preise: alle Karten sind eingeklappt und lassen sich einzeln öffnen.
    await page.goto('/admin/preise/');
    for (const name of [
      'price-basics', 'price-materials', 'price-printers', 'price-coatings',
      'price-shipping', 'price-shipping-options', 'price-discounts',
    ]) {
      const section = page.locator(`[data-collapse="${name}"]`);
      await expect(section).not.toHaveAttribute('open', '');
      await section.locator('> summary').click();
      await expect(section).toHaveAttribute('open', '');
    }
    await expect(page.getByRole('button', { name: 'Alle Änderungen speichern' })).toBeVisible();

    // Stammdaten: sekundäre Bereiche sind eingeklappt, Geschäftsdaten nicht.
    await page.goto('/admin/stammdaten/');
    await expect(page.locator('#businessName')).toBeVisible();
    for (const name of ['site-channels', 'site-contact', 'site-images', 'site-texts']) {
      const section = page.locator(`[data-collapse="${name}"]`);
      await expect(section).not.toHaveAttribute('open', '');
      await section.locator('> summary').click();
      await expect(section).toHaveAttribute('open', '');
    }

    // Zahlungen: Diagnose, Verbindungstest und Ereignislisten sind sichtbar.
    await page.goto('/admin/zahlungen/');
    await expect(page.getByRole('heading', { name: 'Stripe-Diagnose' })).toBeVisible();
    await expect(page.getByText('STRIPE_MODE', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verbindung zu Stripe testen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Letzte fehlgeschlagene Stripe-Zahlungen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Letzte Stripe-Webhooks' })).toBeVisible();
    await page.locator('.admin-help summary').click();
    await expect(page.getByRole('heading', { name: /Online-Zahlung konnte nicht gestartet werden/ })).toBeVisible();

    // Veröffentlichung: To-do-Liste ergänzen, abhaken und wieder entfernen.
    await page.goto('/admin/veroeffentlichung/');
    const checklist = page.locator('.admin-checklist');
    expect(await checklist.locator('li').count()).toBeGreaterThan(0);
    const marker = `E2E-Punkt-${Date.now()}`;
    await page.fill('#newChecklistItem', marker);
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    const added = checklist.locator('li', { hasText: marker });
    await expect(added).toBeVisible();
    await added.getByRole('button', { name: /übernehmen/ }).click();
    await expect(added).toHaveClass(/is-done/);
    page.once('dialog', (dialog) => dialog.accept());
    await added.getByRole('button', { name: /löschen/ }).click();
    await expect(checklist.locator('li', { hasText: marker })).toHaveCount(0);

    // Besucherstatistik: Zeitraum und Gruppierung werden aus der URL gelesen.
    await page.goto('/admin/besucherstatistik/?zeitraum=7&gruppe=woche');
    await expect(page.locator('#zeitraum')).toHaveValue('7');
    await expect(page.locator('#gruppe')).toHaveValue('woche');
    await expect(page.getByRole('heading', { name: 'Aufrufe im Zeitverlauf' })).toBeVisible();

    // Auf dem Handy scrollen die Tabellen innerhalb ihrer Karten.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/besucherstatistik/');
    const statsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(statsOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Live-Suche in der Bestellliste: tippen aktualisiert die Ergebnisse,
    // ohne die Seite neu zu laden (der Fokus bleibt im Suchfeld).
    await page.goto('/admin/bestellungen/');
    await expect(page.getByRole('button', { name: 'Filtern', exact: true })).toBeHidden();
    const search = page.locator('#q');
    await search.fill('zzz-kein-treffer');
    await expect(page.locator('[data-filter-results]')).toContainText('Keine Bestellungen gefunden');
    await expect(page).toHaveURL(/[?&]q=zzz-kein-treffer/);
    await expect(search).toBeFocused();

    // Jede Bestellung hat einen Druckbutton in der Liste und auf der Detailseite.
    await search.fill('');
    const printButtons = page.locator('[data-tooltip="Drucken"]');
    await expect(printButtons.first()).toBeVisible();
    expect(await printButtons.count()).toBeGreaterThan(0);
    await expect(printButtons.first()).toHaveAttribute('aria-label', /^Bestellung .+ drucken$/);
    await printButtons.first().click();
    await expect(page).toHaveURL(/\/admin\/bestellungen\/\d+\/drucken\/$/);
    await expect(page.locator('h1')).toContainText('Bestellung B-');
    await expect(page.getByRole('heading', { name: 'Positionen' })).toBeVisible();
    await expect(page.locator('.admin-print-total')).toContainText('Gesamt');
    await expect(page.locator('[data-print-button]')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.admin-print-toolbar')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('link', { name: 'Zurück zur Bestellung' }).click();
    await expect(page).toHaveURL(/\/admin\/bestellungen\/\d+\/$/);
    await expect(page.getByRole('link', { name: 'Drucken' })).toBeVisible();

    // Icon-Aktionen in Tabellen: quadratisch, mit Tooltip und Statusfarbe.
    await page.goto('/admin/produkte/');
    const action = page.locator('.admin-icon-actions .admin-icon-btn').first();
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('data-tooltip', 'Kopieren');
    const box = await action.boundingBox();
    expect(box?.width).toBe(36);
    expect(box?.height).toBe(36);
    await action.hover();
    await page.waitForTimeout(250);
    expect(await action.evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('1');
    await expect(page.locator('.admin-icon-btn--danger').first()).toHaveCSS('color', 'rgb(179, 38, 30)');

    // Live-Suche in der Produktliste: Treffer und Leerzustand ohne Neuladen.
    await expect(page.getByRole('button', { name: 'Filtern', exact: true })).toBeHidden();
    const productSearch = page.locator('#q');
    await productSearch.fill('zzz-kein-treffer');
    await expect(page.locator('[data-filter-results]')).toContainText('Keine Produkte gefunden');
    await expect(page).toHaveURL(/[?&]q=zzz-kein-treffer/);
    await expect(productSearch).toBeFocused();
    await productSearch.fill('');
    await expect(page.locator('[data-select-product]').first()).toBeVisible();
    await page.locator('[data-select-all]').first().check();
    await expect(page.locator('[data-select-product]').first()).toBeChecked();

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
    await expect(page.getByRole('link', { name: 'Exportieren', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CSV-Import' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CSV-Export' })).toBeVisible();
    await expect(page.locator('[data-select-product]').first()).toBeVisible();

    // Sortierung: Pfeile verschieben Nachbarn und vergeben eindeutige Nummern.
    await page.goto('/admin/produkte/');
    const orderRows = page.locator('table[data-product-order-table] tbody tr');
    expect(await orderRows.count()).toBeGreaterThan(1);
    await expect(page.locator('.admin-sort-grip').first()).toBeVisible();
    const firstName = await orderRows.first().locator('strong').innerText();
    const secondName = await orderRows.nth(1).locator('strong').innerText();
    await orderRows.first().getByRole('button', { name: /nach unten verschieben/ }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?sortiert=1/);
    await expect(page.getByText('Die Sortierung wurde gespeichert.')).toBeVisible();
    await expect(orderRows.first().locator('strong')).toHaveText(secondName);
    await expect(orderRows.nth(1).locator('strong')).toHaveText(firstName);
    const orderNumbers = await page.locator('.admin-sort-number').allInnerTexts();
    expect(new Set(orderNumbers).size).toBe(orderNumbers.length);

    // Ausgangsreihenfolge wiederherstellen, damit der Lauf wiederholbar ist.
    await orderRows.nth(1).getByRole('button', { name: /nach oben verschieben/ }).click();
    await expect(orderRows.first().locator('strong')).toHaveText(firstName);

    // Drag & Drop: erste Zeile unter die zweite ziehen und wieder zurück.
    await page.evaluate(() => window.scrollTo(0, 0));
    await orderRows.nth(1).scrollIntoViewIfNeeded();
    const sourceBox = await orderRows.first().boundingBox();
    const targetBox = await orderRows.nth(1).boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Produktzeilen sind nicht sichtbar.');
    await page.mouse.move(sourceBox.x + 600, sourceBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + 600, targetBox.y + targetBox.height - 10, { steps: 15 });
    await page.mouse.up();
    await expect(orderRows.first().locator('strong')).toHaveText(secondName);
    await orderRows.nth(1).getByRole('button', { name: /nach oben verschieben/ }).click();
    await expect(orderRows.first().locator('strong')).toHaveText(firstName);

    // CSV-Export liefert eine Datei mit BOM und bekannter Kopfzeile.
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'CSV-Export' }).click(),
    ]);
    expect(csvDownload.suggestedFilename()).toMatch(/^3d-mir-produkte-\d{4}-\d{2}-\d{2}\.csv$/);
    const csvFile = '/tmp/opencode/e2e-produkte.csv';
    await csvDownload.saveAs(csvFile);
    expect(readFileSync(csvFile, 'utf8').startsWith('\uFEFFsku;slug;name;')).toBeTruthy();

    // CSV-Import legt ein Produkt an; die gleiche SKU aktualisiert es danach.
    const csv = [
      '\uFEFFsku;slug;name;kategorien;preisAb;varianten;farben',
      'e2e-csv-2026;e2e-csv-2026;E2E CSV Produkt;kueche;9,90;Standard|9,90|3;rot',
    ].join('\n');
    await page.goto('/admin/produkte/csv/import/');
    await page.setViewportSize({ width: 390, height: 844 });
    const csvOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(csvOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.locator('#csv_file').setInputFiles({
      name: 'produkte.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    });
    await page.getByRole('button', { name: 'Import starten' }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?gespeichert=1/);
    await expect(page.getByText('1 Produkt(e) wurden importiert oder aktualisiert.')).toBeVisible();

    await page.goto('/admin/produkte/csv/import/');
    const updatedCsv = csv
      .replace('E2E CSV Produkt', 'E2E CSV Produkt Aktualisiert')
      .replace('9,90;Standard|9,90|3', '12,50;Standard|12,50|3');
    await page.locator('#csv_file').setInputFiles({
      name: 'produkte.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(updatedCsv, 'utf8'),
    });
    await page.getByRole('button', { name: 'Import starten' }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?gespeichert=1/);
    await expect(page.locator('[data-filter-results]')).toContainText('E2E CSV Produkt Aktualisiert');

    // Testdaten wieder entfernen, damit der Lauf wiederholbar ist.
    await page.locator('#q').fill('e2e-csv-2026');
    await expect(page).toHaveURL(/[?&]q=e2e-csv-2026/);
    await expect(page.locator('[data-filter-results] tbody tr')).toHaveCount(1);
    await page.locator('[data-select-product]').first().check();
    await page.getByRole('button', { name: 'Ausgewählte löschen' }).click();
    await expect(page.getByRole('heading', { name: 'Produkte löschen' })).toBeVisible();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?geloescht=1/);

    await page.locator('table tbody tr a').first().click();
    await expect(page.getByRole('heading', { name: 'Bilder', exact: true })).toBeVisible();
    await expect(page.locator('#personalizationPrice')).toHaveAttribute('type', 'number');
    await expect(page.locator('#image_file')).toHaveAttribute('multiple', '');

    // Sekundäre Bereiche sind initial eingeklappt und lassen sich einzeln öffnen.
    const sections = [
      'description', 'categories', 'shipping-methods', 'shipping-options',
      'product-options', 'variants', 'images',
    ];
    for (const name of sections) {
      await expect(page.locator(`[data-collapse="${name}"]`)).not.toHaveAttribute('open', '');
    }
    await expect(page.locator('#description')).toBeHidden();
    await expect(page.locator('#colorOptions')).toBeHidden();
    await expect(page.locator('input[name="new_label"]')).toBeHidden();
    await expect(page.locator('#image_file')).toBeHidden();

    const description = page.locator('[data-collapse="description"]');
    await description.locator('summary').click();
    await expect(description).toHaveAttribute('open', '');
    await expect(page.locator('#description')).toBeVisible();

    const options = page.locator('[data-collapse="product-options"]');
    await options.locator('summary').click();
    await expect(page.locator('#colorOptions')).toBeVisible();

    const images = page.locator('[data-collapse="images"]');
    await images.locator('summary').click();
    await expect(page.getByRole('heading', { name: 'Bild hinzufügen', exact: true })).toBeVisible();
    await expect(page.locator('#image_file')).toBeVisible();

    // Nachrichtenliste auf dem Handy: Die Tabelle bleibt in einer Karte und
    // scrollt dort, statt die gesamte Seite zu verschieben.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/nachrichten/');
    if (await page.locator('.admin-message-table').count()) {
      const wrapper = page.locator('.admin-message-table').locator('xpath=ancestor::div[contains(@class, "table-wrap")]');
      await expect(wrapper).toHaveCSS('overflow-x', 'auto');
    }
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/login\/\?abgemeldet=1/);

    const response = await page.goto('/admin/bestellungen/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/login\//);

    expect(errors).toEqual([]);
  });
});
