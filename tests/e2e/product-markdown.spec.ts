import { expect, test, type Page } from '@playwright/test';

/**
 * Markdown für Produkttexte: Formatierungsbuttons, Umschalter zwischen Code und
 * Vorschau im Admin sowie die Darstellung in Shop-Übersicht und Produktseite.
 */
const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

const openSection = async (page: Page, name: string): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  const section = page.locator(`[data-collapse="${name}"]`);
  if ((await section.getAttribute('open')) === null) {
    await section.locator('> summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
};

test.describe('Produkttexte mit Markdown', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Formatieren, Vorschau und Darstellung im Shop', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const suffix = Date.now().toString(36);
    const name = `E2E Markdownprodukt ${suffix}`;
    const slug = `e2e-markdownprodukt-${suffix}`;

    await page.goto('/admin/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/produkte/neu/');
    await page.fill('#name', name);
    await page.fill('#slug', slug);
    await page.fill('#priceFrom', '10.00');

    // Kurztext: Umschalter zeigt formatierte Vorschau.
    const shortEditor = page.locator('[data-markdown-editor]').first();
    await shortEditor.locator('textarea').fill('**Kurz** fett');
    await shortEditor.locator('[data-md-toggle]').click();
    await expect(shortEditor.locator('[data-md-toggle]')).toHaveText('Code bearbeiten');
    await expect(shortEditor.locator('.md-preview strong')).toHaveText('Kurz');
    await shortEditor.locator('[data-md-toggle]').click();
    await expect(shortEditor.locator('textarea')).toBeVisible();

    // Langtext: Button formatiert die markierte Auswahl.
    await openSection(page, 'description');
    const longEditor = page.locator('[data-markdown-editor]').nth(1);
    await longEditor.locator('textarea').fill('### Titel\n\n- eins\n- zwei');
    await longEditor.locator('textarea').focus();
    await longEditor.locator('[data-md-action="bold"]').click();
    await expect(longEditor.locator('textarea')).toHaveValue('### Titel\n\n- eins\n- zwei**fetter Text**');

    // Rückgängig/Wiederholen wirken auch auf die Button-Formatierung.
    await expect(longEditor.locator('[data-md-action="redo"]')).toBeDisabled();
    await longEditor.locator('[data-md-action="undo"]').click();
    await expect(longEditor.locator('textarea')).toHaveValue('### Titel\n\n- eins\n- zwei');
    await expect(longEditor.locator('[data-md-action="redo"]')).toBeEnabled();
    await longEditor.locator('[data-md-action="redo"]').click();
    await expect(longEditor.locator('textarea')).toHaveValue('### Titel\n\n- eins\n- zwei**fetter Text**');
    await expect(longEditor.locator('[data-md-action="redo"]')).toBeDisabled();

    await longEditor.locator('[data-md-toggle]').click();
    await expect(longEditor.locator('.md-preview h3')).toHaveText('Titel');
    await expect(longEditor.locator('.md-preview li')).toHaveCount(2);
    await longEditor.locator('[data-md-toggle]').click();

    // Der Quelltext wird gespeichert (auch wenn zuletzt die Vorschau aktiv war).
    await longEditor.locator('[data-md-toggle]').click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produkte\/\d+\/\?gespeichert=1/);
    await openSection(page, 'description');
    await expect(page.locator('#description')).toHaveValue(/### Titel/);

    // Shop-Übersicht und Produktseite zeigen das gerenderte HTML.
    await page.goto('/shop/');
    const card = page.locator('.product-card').filter({ has: page.locator(`a[href="/shop/${slug}/"]`) });
    await expect(card.locator('.product-card-short strong')).toHaveText('Kurz');

    await page.goto(`/shop/${slug}/`);
    await expect(page.locator('.product-short-description strong')).toHaveText('Kurz');
    await expect(page.locator('.product-description h3')).toHaveText('Titel');
    await expect(page.locator('.product-description li')).toHaveCount(2);

    expect(errors).toEqual([]);
  });
});
