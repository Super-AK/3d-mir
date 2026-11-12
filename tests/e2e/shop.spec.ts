import { expect, test } from '@playwright/test';

test('Shop: Produkt in den Warenkorb legen und bestellen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/shop/');
  await expect(page.locator('h1')).toHaveText('Shop');
  await page.getByRole('link', { name: 'Details ansehen' }).click();
  await expect(page.locator('h1')).toContainText('Recycling-Box');

  await page.selectOption('#variantId', { index: 1 });
  await page.fill('#quantity', '1');
  await page.getByRole('button', { name: 'In den Warenkorb' }).click();

  await expect(page).toHaveURL(/\/warenkorb\/$/);
  await expect(page.locator('.cart-item')).toHaveCount(1);
  await expect(page.locator('.cart-item')).toContainText('Recycling-Box');
  await expect(page.locator('[data-cart-count]')).toHaveText('1');

  await page.getByRole('link', { name: 'Zur Kasse' }).click();
  await expect(page).toHaveURL(/\/kasse\/$/);
  await expect(page.locator('button[type="submit"]')).toHaveText('zahlungspflichtig bestellen');

  // Versandwechsel aktualisiert die Summe ohne Neuladen.
  await page.check('input[name="shippingMethod"][value="abholung"]');
  await expect(page.locator('[data-summary-total]')).toHaveText('11,00 €');
  await page.check('input[name="shippingMethod"][value="dhl-paket"]');
  await expect(page.locator('[data-summary-total]')).toHaveText('15,99 €');

  await page.fill('#firstName', 'Playwright');
  await page.fill('#lastName', 'Test');
  await page.fill('#email', `playwright-${Date.now()}@example.com`);
  await page.fill('#street', 'Teststraße 1');
  await page.fill('#zip', '12345');
  await page.fill('#city', 'Teststadt');
  await page.check('input[name="consent"]');
  await page.getByRole('button', { name: 'zahlungspflichtig bestellen' }).click();

  await expect(page).toHaveURL(/\/bestellung\/danke\/\?nummer=B-\d{4}-[A-Z2-9]{5}$/);
  await expect(page.locator('h1')).toContainText('Vielen Dank');
  await expect(page.locator('.summary-total')).toContainText('€');
  expect(errors).toEqual([]);
});

test('Kasse ohne Artikel leitet zum Warenkorb', async ({ page }) => {
  const response = await page.goto('/kasse/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/warenkorb\/$/);
  await expect(page.locator('h1')).toHaveText('Warenkorb');
});
