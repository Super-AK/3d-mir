import { expect, test } from '@playwright/test';

/**
 * Varianten, Farben und Personalisierung: Produkte ohne Varianten sind direkt
 * kaufbar, Farben sind eine zusätzliche Auswahl und die Personalisierung ist
 * optional. Die Produkte werden über den Admin-Bereich angelegt, damit der
 * Test denselben Weg wie der Betreiber nutzt.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

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
    await page.fill('#colorOptions', 'Rot, Blau');
    await page.check('input[name="personalizationEnabled"]');
    await page.fill('#personalizationHint', 'z. B. Wunschname für Anna');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    // Produkt ohne Varianten: kein Variantenfeld, aber Farbauswahl und
    // Personalisierung.
    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('#variantId')).toHaveCount(0);
    await expect(page.locator('#color option')).toHaveCount(3);
    await expect(page.locator('#personalization')).toBeVisible();
    await expect(page.locator('#personalization')).toHaveAttribute('placeholder', 'z. B. Wunschname für Anna');
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
    await expect(page.locator('.cart-item')).toContainText('Personalisierung: Für Anna');
    await expect(page.locator('.cart-item')).toContainText('25,00 €');

    // Menge über den stabilen Zeilenschlüssel ändern und Position entfernen.
    await page.fill('.cart-quantity input', '3');
    await page.getByRole('button', { name: 'Aktualisieren' }).click();
    await expect(page.locator('.cart-item')).toContainText('37,50 €');
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
    await page.fill('#colorOptions', 'Grün, Schwarz');
    await page.check('input[name="personalizationEnabled"]');
    await page.check('input[name="shippingMethodIds"][value="dhl-paket"]');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    // Echte Variante mit eigenem Preis ergänzen.
    await page.fill('input[name="new_label"]', 'Groß');
    await page.fill('input[name="new_price"]', '25.00');
    await page.getByRole('button', { name: 'Varianten speichern' }).click();
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
});
