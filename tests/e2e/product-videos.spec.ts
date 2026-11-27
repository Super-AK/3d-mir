import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

/**
 * Produktvideos: Upload und Löschen im Admin-Bereich sowie die Anzeige auf der
 * öffentlichen Produktseite. Das Testprodukt wird am Ende wieder entfernt.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Minimal-gültige MP4-Datei (ftyp-Box), wie sie die Validierung erwartet. */
const mp4 = Buffer.concat([Buffer.from('000000186674797069736f6d', 'hex'), Buffer.alloc(32)]);

/** Öffnet den initial eingeklappten Videos-Bereich. */
const openVideos = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  const section = page.locator('[data-collapse="videos"]');
  if ((await section.getAttribute('open')) === null) {
    await section.locator('> summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
};

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

    // Videobereich ist standardmäßig eingeklappt (wie der Bilderbereich).
    await expect(page.locator('[data-collapse="videos"]')).not.toHaveAttribute('open', '');
    await openVideos(page);
    await page.setInputFiles('#video_file', [
      { name: 'e2e-video.mp4', mimeType: 'video/mp4', buffer: mp4 },
    ]);
    await page.fill('#video_title', 'Produkt in Aktion');
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Video hochladen' }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);
    await openVideos(page);

    const adminVideos = page.locator('.admin-video-item');
    await expect(adminVideos).toHaveCount(1);
    await expect(adminVideos.locator('video')).toHaveAttribute('src', /^\/media\/videos\/video-[a-f0-9]+\.mp4$/);
    await expect(adminVideos).toContainText('Produkt in Aktion');

    // Zusätzlich ein Bild hochladen – Video und Foto teilen sich eine Galerie.
    const imageSection = page.locator('[data-collapse="images"]');
    if ((await imageSection.getAttribute('open')) === null) {
      await imageSection.locator('> summary').click();
    }
    const image = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 40, g: 90, b: 220 } } })
      .png()
      .toBuffer();
    await page.setInputFiles('#image_file', [{ name: 'e2e-blau.png', mimeType: 'image/png', buffer: image }]);
    await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Bilder hochladen' }).click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);

    // Öffentliche Produktseite: das Video ist die erste Folie der Galerie und startet automatisch.
    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('.product-videos')).toHaveCount(0);
    const slides = page.locator('.product-gallery [data-gallery-slide]');
    await expect(slides).toHaveCount(2);
    await expect(slides.first()).toHaveClass(/is-active/);
    const publicVideo = slides.first().locator('video');
    await expect(publicVideo).toHaveCount(1);
    await expect(publicVideo).toHaveAttribute('autoplay', '');
    await expect(publicVideo).toHaveAttribute('muted', '');
    await expect(publicVideo).toHaveAttribute('playsinline', '');
    const videoSrc = await publicVideo.getAttribute('src');
    expect(videoSrc).toMatch(/^\/media\/videos\/video-[a-f0-9]+\.mp4$/);
    await expect(slides.nth(1).locator('img')).toHaveCount(1);
    await expect(page.locator('.gallery-thumb-video')).toHaveCount(1);
    await expect(page.locator('[data-gallery-thumb]')).toHaveCount(2);

    // Klick öffnet die Vergrößerung mit dem Video; Vor/Zurück wechselt zum Foto.
    await page.locator('.product-gallery [data-gallery-open]').first().click();
    const dialog = page.locator('[data-gallery-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-gallery-dialog-video]')).toBeVisible();
    await expect(dialog.locator('[data-gallery-counter]')).toHaveText('1 / 2');
    await dialog.locator('[data-gallery-next]').click();
    await expect(dialog.locator('[data-gallery-dialog-image]')).toBeVisible();
    await expect(dialog.locator('[data-gallery-counter]')).toHaveText('2 / 2');
    await dialog.locator('[data-gallery-close]').click();

    // Datei ist öffentlich erreichbar.
    const response = await page.request.get(videoSrc!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('video/mp4');

    // Übersicht kennzeichnet Produkte mit Video.
    await page.goto('/shop/');
    const card = page.locator('.product-card').filter({ has: page.locator(`a[href="/shop/${slug}/"]`) });
    await expect(card).toHaveCount(1);
    await expect(card.locator('.product-card-video')).toBeVisible();
    await expect(card.locator('h2')).toContainText('Video verfügbar');

    // Hover startet die Vorschau und versteckt sie beim Verlassen wieder.
    const preview = card.locator('.product-card-video-preview');
    await expect(preview).toHaveCount(1);
    await expect(preview).toHaveAttribute('muted', '');
    await expect(preview).toHaveAttribute('loop', '');
    await expect(preview).toHaveAttribute('preload', 'none');
    await card.hover();
    await expect(card).toHaveClass(/is-video-hover/);
    await expect(preview).toHaveCSS('opacity', '1');
    await page.mouse.move(0, 0);
    await expect(card).not.toHaveClass(/is-video-hover/);

    // Löschen entfernt sowohl Datenbank-Eintrag als auch Datei.
    await page.goto(`/admin/produkte/${productId}/`);
    await openVideos(page);
    await expect(adminVideos).toHaveCount(1);
    await Promise.all([
      page.waitForNavigation(),
      adminVideos.getByRole('button', { name: 'Video löschen' }).click(),
    ]);
    await expect(page).toHaveURL(/\?geloescht=1/);
    await expect(adminVideos).toHaveCount(0);
    const afterDelete = await page.request.get(videoSrc!);
    expect(afterDelete.status()).toBe(404);

    // Ohne Video verschwindet die Kennzeichnung auf der Übersicht wieder.
    await page.goto('/shop/');
    await expect(card.locator('.product-card-video')).toHaveCount(0);

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
