import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = path.join(process.cwd(), 'tests', 'fixtures', 'cube.stl');

test('Startseite lädt ohne JavaScript-Fehler', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('Ihre Idee');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Rechner analysiert ein STL und zeigt einen Preis', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/3d-druck-rechner/');
  await page.locator('#model').setInputFiles(fixture);

  await expect(page.locator('[data-metric-dimensions]')).toHaveText('10 × 10 × 10 mm', { timeout: 15_000 });
  await expect(page.locator('[data-price]')).not.toHaveText('–');
  await expect(page.locator('[data-weight]')).not.toHaveText('–');
  await expect(page.locator('[data-submit]')).toBeEnabled();
  await expect(page.locator('[data-preview-empty]')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('[data-preview-orientation]')).toHaveText('Liegend anzeigen');
  await page.locator('[data-preview-orientation]').click();
  await expect(page.locator('[data-preview-orientation]')).toHaveText('Stehend anzeigen');

  // Die Schätzung muss einen plausiblen Preis liefern (Mindestwert ist im Admin konfigurierbar).
  const priceText = (await page.locator('[data-price]').textContent()) ?? '';
  const price = Number(priceText.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'));
  expect(price).toBeGreaterThan(0);

  expect(errors).toEqual([]);
});

test('Rechtsseiten sind erreichbar', async ({ page }) => {
  for (const path of ['/impressum/', '/datenschutz/', '/agb/', '/widerruf/', '/versand/', '/zahlung/']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('h1'), path).toBeVisible();
  }
});
