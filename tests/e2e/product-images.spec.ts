import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

/**
 * Produktbilder: Sortierung, kleine Miniaturen und Zuschnitt werden über den
 * Admin-Bereich geprüft. Das Testprodukt wird am Ende wieder entfernt.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

const solidImage = (color: { r: number; g: number; b: number }): Promise<Buffer> =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: color } }).png().toBuffer();

/** Öffnet den initial eingeklappten Bilderbereich. */
const openImages = async (page: Page): Promise<void> => {
  // Nach Formular-Redirects kann toHaveURL vor dem neuen Dokument auflösen.
  await page.waitForLoadState('domcontentloaded');
  const section = page.locator('[data-collapse="images"]');
  if ((await section.getAttribute('open')) === null) {
    await section.locator('> summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
};

test.describe('Produktbilder', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Miniaturen, Sortierung per Pfeil und Zuschnitt', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Bildprodukt ${suffix}`;
    const slug = `e2e-bildprodukt-${suffix}`;

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
    await openImages(page);

    await page.setInputFiles('#image_file', [
      { name: 'e2e-rot.png', mimeType: 'image/png', buffer: await solidImage({ r: 210, g: 40, b: 40 }) },
      { name: 'e2e-blau.png', mimeType: 'image/png', buffer: await solidImage({ r: 40, g: 90, b: 220 }) },
    ]);
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Bilder hochladen' }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);
    await openImages(page);

    const cards = page.locator('.admin-image-card[data-image-id]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('img')).toHaveAttribute('width', '240');
    await expect(cards.first().locator('img')).toHaveCSS('height', '112px');
    const files = await cards.locator('code.admin-code').allInnerTexts();
    expect(files[0]).not.toBe(files[1]);

    // Pfeil nach unten tauscht die Reihenfolge; die Nummern bleiben eindeutig.
    await Promise.all([
      page.waitForNavigation(),
      cards.first().getByRole('button', { name: /nach unten verschieben/ }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?sortiert=1/);
    await openImages(page);
    await expect(cards.first().locator('code.admin-code')).toHaveText(files[1]!);
    await expect(cards.nth(1).locator('code.admin-code')).toHaveText(files[0]!);
    await expect(cards.first().locator('.admin-sort-number')).toHaveText('1');
    await expect(cards.nth(1).locator('.admin-sort-number')).toHaveText('2');

    // Drag & Drop stellt die ursprüngliche Reihenfolge wieder her.
    await page.evaluate(() => window.scrollTo(0, 0));
    await cards.nth(1).scrollIntoViewIfNeeded();
    const source = await cards.first().boundingBox();
    const target = await cards.nth(1).boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    await page.mouse.move(source!.x + 20, source!.y + 12);
    await page.mouse.down();
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height - 10, { steps: 15 });
    const dragNavigation = page.waitForNavigation();
    await page.mouse.up();
    await dragNavigation;
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?sortiert=1/);
    await openImages(page);
    await expect(cards.first().locator('code.admin-code')).toHaveText(files[0]!);

    // Zuschnitt: Dialog öffnen, Ausschnitt verkleinern und speichern.
    await cards.first().locator('[data-product-image-crop]').click();
    const dialog = page.locator('[data-product-crop-modal]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-product-crop-image]')).toBeVisible();

    const handle = dialog.locator('[data-crop-handle="se"]');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 90, box!.y - 70, { steps: 10 });
    await page.mouse.up();
    await Promise.all([
      page.waitForNavigation(),
      dialog.getByRole('button', { name: 'Zuschnitt speichern' }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);
    await openImages(page);

    const croppedFile = await cards.first().locator('code.admin-code').innerText();
    expect(croppedFile).not.toBe(files[0]);
    // Der zugeschnittene Ausschnitt bleibt das erste Bild.
    await expect(cards.first().locator('img')).toHaveAttribute('src', /\/media\//);

    // Testdaten entfernen.
    await page.goto('/admin/produkte/');
    await page.locator('#q').fill(slug);
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.locator('[data-filter-results] tbody tr')).toHaveCount(1);
    await page.locator('[data-select-product]').first().check();
    await page.getByRole('button', { name: 'Ausgewählte löschen' }).click();
    await expect(page.getByRole('heading', { name: 'Produkte löschen' })).toBeVisible();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?geloescht=1/);

    expect(errors).toEqual([]);
  });
});
