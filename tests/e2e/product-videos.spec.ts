import { expect, test } from '@playwright/test';

/**
 * Produktvideos: Upload und Löschen im Admin-Bereich sowie die Anzeige auf der
 * öffentlichen Produktseite. Das Testprodukt wird am Ende wieder entfernt.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Minimal-gültige MP4-Datei (ftyp-Box), wie sie die Validierung erwartet. */
const mp4 = Buffer.concat([Buffer.from('000000186674797069736f6d', 'hex'), Buffer.alloc(32)]);

test.describe('Produktvideos', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Video hochladen, auf der Produktseite anzeigen und löschen', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Videoprodukt ${suffix}`;
    const slug = `e2e-videoprodukt-${suffix}`;

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
    const productId = page.url().match(/\/produkte\/(\d+)\//)?.[1];
    expect(productId).toBeDefined();

    // Videobereich ist immer sichtbar (keine eingeklappte Details-Sektion).
    await page.setInputFiles('#video_file', [
      { name: 'e2e-video.mp4', mimeType: 'video/mp4', buffer: mp4 },
    ]);
    await page.fill('#video_title', 'Produkt in Aktion');
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Video hochladen' }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    const adminVideos = page.locator('.admin-video-item');
    await expect(adminVideos).toHaveCount(1);
    await expect(adminVideos.locator('video')).toHaveAttribute('src', /^\/media\/videos\/video-[a-f0-9]+\.mp4$/);
    await expect(adminVideos).toContainText('Produkt in Aktion');

    // Öffentliche Produktseite zeigt das Video unter der Bildergalerie.
    await page.goto(`/shop/${slug}/`);
    const publicVideos = page.locator('.product-videos video');
    await expect(publicVideos).toHaveCount(1);
    const videoSrc = await publicVideos.getAttribute('src');
    expect(videoSrc).toMatch(/^\/media\/videos\/video-[a-f0-9]+\.mp4$/);
    await expect(page.locator('.product-videos figcaption')).toHaveText('Produkt in Aktion');

    // Datei ist öffentlich erreichbar.
    const response = await page.request.get(videoSrc!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('video/mp4');

    // Löschen entfernt sowohl Datenbank-Eintrag als auch Datei.
    await page.goto(`/admin/produkte/${productId}/`);
    await expect(adminVideos).toHaveCount(1);
    await Promise.all([
      page.waitForNavigation(),
      adminVideos.getByRole('button', { name: 'Video löschen' }).click(),
    ]);
    await expect(page).toHaveURL(/\?geloescht=1/);
    await expect(adminVideos).toHaveCount(0);
    const afterDelete = await page.request.get(videoSrc!);
    expect(afterDelete.status()).toBe(404);

    // Testdaten entfernen.
    await page.goto('/admin/produkte/');
    await page.locator('#q').fill(slug);
    await expect(page.locator('[data-filter-results] tbody tr')).toHaveCount(1);
    await page.locator('[data-select-product]').first().check();
    await page.getByRole('button', { name: 'Ausgewählte löschen' }).click();
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\?geloescht=1/);

    expect(errors).toEqual([]);
  });
});
