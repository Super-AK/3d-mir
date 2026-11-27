import { expect, test, type Page } from '@playwright/test';

/**
 * Varianten, Farben und Personalisierung: Produkte ohne Varianten sind direkt
 * kaufbar, Farben sind eine zusätzliche Auswahl und die Personalisierung ist
 * optional. Die Produkte werden über den Admin-Bereich angelegt, damit der
 * Test denselben Weg wie der Betreiber nutzt.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Öffnet einen initial eingeklappten Bereich des Produktformulars. */
const openSection = async (page: Page, name: string): Promise<void> => {
  // Nach Formular-Redirects kann toHaveURL vor dem neuen Dokument auflösen.
  await page.waitForLoadState('domcontentloaded');
  const section = page.locator(`[data-collapse="${name}"]`);
  if ((await section.getAttribute('open')) === null) {
    await section.locator('> summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
};

test.describe('Varianten, Farben und Personalisierung', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Produkt ohne Variante mit Farbe und optionaler Personalisierung', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Farbprodukt ${suffix}`;
    const slug = `e2e-farbprodukt-${suffix}`;

    await page.goto('/admin/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/produkte/neu/');
    await page.fill('#name', name);
    await page.fill('#slug', slug);
    await page.fill('#priceFrom', '12.50');
    await page.fill('#material', 'PETG');
    await page.fill('#deliveryNote', 'sofort lieferbar');
    await openSection(page, 'product-options');
    await page.fill('#colorOptions', 'Rot, Blau');
    await page.check('input[name="personalizationEnabled"]');
    await page.fill('#personalizationHint', 'z. B. Wunschname für Anna');
    await page.fill('#personalizationPrice', '2.50');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    // Produkt ohne Varianten: kein Variantenfeld, aber Farbauswahl und
    // Personalisierung.
    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('#variantId')).toHaveCount(0);
    await expect(page.locator('#color option')).toHaveCount(3);
    await expect(page.locator('#personalization')).toBeVisible();
    await expect(page.locator('#personalization')).toHaveAttribute('placeholder', 'z. B. Wunschname für Anna');
    await expect(page.getByText('Bei Eingabe berechnen wir 2,50 € pro Stück zusätzlich.')).toBeVisible();
    await expect(page.locator('.product-facts')).toContainText('Material: PETG, in Wunschfarbe');
    await expect(page.locator('.product-facts')).toContainText('Abholung: nach Absprache in Schömberg möglich');
    await expect(page.locator('.product-facts')).toContainText('Versand: ab 0,00 €, frei ab 50,00 €');
    await expect(page.locator('.product-facts')).toContainText(
      'Lieferzeit: DHL Paket: 2–5 Werktage, sofort lieferbar',
    );
    await page.selectOption('#color', 'Blau');
    await page.fill('#personalization', 'Für Anna');
    await page.fill('#quantity', '2');
    await page.getByRole('button', { name: 'In den Warenkorb' }).click();

    await expect(page).toHaveURL(/\/warenkorb\/$/);
    await expect(page.locator('.cart-item')).toContainText('Farbe: Blau');
    await expect(page.locator('.cart-item')).toContainText('Personalisierung: Für Anna (+ 2,50 € pro Stück)');
    await expect(page.locator('.cart-item')).toContainText('30,00 €');

    // Menge über den stabilen Zeilenschlüssel ändern und Position entfernen.
    await page.fill('.cart-quantity input', '3');
    await page.getByRole('button', { name: 'Aktualisieren' }).click();
    await expect(page.locator('.cart-item')).toContainText('45,00 €');
    await page.getByRole('button', { name: 'Entfernen' }).click();
    await expect(page.locator('.cart-item')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('Variante, Farbe und Personalisierung kombinierbar', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Variantenprodukt ${suffix}`;
    const slug = `e2e-variantenprodukt-${suffix}`;

    await page.goto('/admin/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/produkte/neu/');
    await page.fill('#name', name);
    await page.fill('#slug', slug);
    await page.fill('#priceFrom', '20.00');
    await openSection(page, 'product-options');
    await page.fill('#colorOptions', 'Grün, Schwarz');
    await page.check('input[name="personalizationEnabled"]');
    await openSection(page, 'shipping-methods');
    await page.check('input[name="shippingMethodIds"][value="dhl-paket"]');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    // Echte Variante mit eigenem Preis ergänzen.
    await openSection(page, 'variants');
    await page.fill('input[name="new_label"]', 'Groß');
    await page.fill('input[name="new_price"]', '25.00');
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Varianten speichern' }).click(),
    ]);
    await openSection(page, 'variants');
    await expect(page.locator('input[name$="_label"][value="Groß"]')).toBeVisible();

    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('#personalization')).toHaveAttribute('placeholder', 'z. B. Name oder kurzer Text');
    await expect(page.locator('.product-facts')).toContainText('Material: PLA, in Wunschfarbe');
    await expect(page.locator('.product-facts')).not.toContainText('Abholung:');
    await expect(page.locator('.product-facts')).toContainText('Versand: 4,99 €, frei ab 50,00 €');
    await expect(page.locator('.product-facts')).not.toContainText('Versand: ab 4,99 €');
    await expect(page.locator('.product-facts')).toContainText(
      'Lieferzeit: 2–5 Werktage, Fertigung nach Bezahlung',
    );
    await page.selectOption('#variantId', { index: 1 });
    await page.selectOption('#color', 'Grün');
    // Personalisierung bleibt leer und ist trotzdem gültig.
    await page.getByRole('button', { name: 'In den Warenkorb' }).click();

    await expect(page).toHaveURL(/\/warenkorb\/$/);
    await expect(page.locator('.cart-item')).toContainText('Variante: Groß');
    await expect(page.locator('.cart-item')).toContainText('Farbe: Grün');
    await expect(page.locator('.cart-item')).not.toContainText('Personalisierung');
    await expect(page.locator('.cart-item')).toContainText('25,00 €');

    expect(errors).toEqual([]);
  });

  test('Mehrere neue Varianten ohne Neuladen anlegen', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Mehrvarianten ${suffix}`;
    const slug = `e2e-mehrvarianten-${suffix}`;

    await page.goto('/admin/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/produkte/neu/');
    await page.fill('#name', name);
    await page.fill('#slug', slug);
    await page.fill('#priceFrom', '10.00');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);
    await openSection(page, 'variants');

    await page.fill('input[name="new_label"]', 'Klein');
    await page.fill('input[name="new_price"]', '10.00');

    // Marker bleibt erhalten, solange keine Seite neu geladen wird.
    await page.evaluate(() => {
      (window as unknown as { __variantMarker?: number }).__variantMarker = 1;
    });
    await page.getByRole('button', { name: 'Weitere Variante hinzufügen' }).click();
    await expect(page.locator('input[name="new_label_1"]')).toBeVisible();
    await page.fill('input[name="new_label_1"]', 'Mittel');
    await page.fill('input[name="new_price_1"]', '12.00');
    await page.fill('input[name="new_stock_1"]', '5');

    await page.getByRole('button', { name: 'Weitere Variante hinzufügen' }).click();
    await expect(page.locator('input[name="new_label_2"]')).toBeVisible();
    await page.fill('input[name="new_label_2"]', 'Groß');
    await page.fill('input[name="new_price_2"]', '15.00');
    expect(await page.evaluate(() => (window as unknown as { __variantMarker?: number }).__variantMarker)).toBe(1);

    // Eine hinzugefügte Zeile lässt sich wieder entfernen.
    await page
      .locator('tr')
      .filter({ has: page.locator('input[name="new_label_2"]') })
      .getByRole('button', { name: 'Neue Variante entfernen' })
      .click();
    await expect(page.locator('input[name="new_label_2"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Weitere Variante hinzufügen' }).click();
    const thirdLabel = page.locator('input[name^="new_label_"]').last();
    const thirdIndex = (await thirdLabel.getAttribute('name'))!.replace('new_label_', '');
    await thirdLabel.fill('Groß');
    await page.fill(`input[name="new_price_${thirdIndex}"]`, '15.00');

    // Erst jetzt ein einziger Speichervorgang für alle drei Varianten.
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Varianten speichern' }).click(),
    ]);
    await expect(page).toHaveURL(/\?gespeichert=1/);
    await openSection(page, 'variants');
    const labels = await page
      .locator('input[name^="variant_"][name$="_label"]')
      .evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value));
    expect(labels).toEqual(['Klein', 'Mittel', 'Groß']);

    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('#variantId option')).toHaveCount(4);

    expect(errors).toEqual([]);
  });
});
