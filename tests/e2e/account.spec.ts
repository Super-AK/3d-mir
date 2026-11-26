import { expect, test } from '@playwright/test';

test('Kontolink in Navigation und schmale Login-Karte', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-nav a[aria-label="Mein Konto"]')).toBeVisible();
  await expect(page.locator('.site-footer a[href="/konto/"]')).toBeVisible();

  await page.goto('/konto/');
  await expect(page).toHaveURL(/\/konto\/anmelden\//);
  const card = page.locator('.account-auth-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(600);
});

test('Kundenbereich: Layout auf allen Seiten', async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL ?? '';
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? '';
  test.skip(!email || !password, 'Kunden-Testkonto fehlt');

  await page.goto('/konto/anmelden/');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/konto\/$/);

  const shell = page.locator('.account-shell');
  await expect(shell).toBeVisible();
  const box = await shell.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(1100);
  await expect(page.locator('.account-tab')).toHaveCount(4);
  await expect(page.locator('.account-tab.is-active')).toHaveCount(1);
  await expect(page.locator('.account-card').first()).toBeVisible();

  for (const [path, tab] of [
    ['/konto/', 'Übersicht'],
    ['/konto/bestellungen/', 'Bestellungen'],
    ['/konto/anfragen/', 'Angebotsanfragen'],
    ['/konto/daten/', 'Meine Daten'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('.account-shell')).toBeVisible();
    await expect(page.locator('.account-tab.is-active')).toHaveCount(1);
    await expect(page.locator('.account-tab.is-active')).toHaveText(tab);
    await expect(page.locator('.account-head .btn')).toBeVisible();
  }
});

test('Kundenkonto: Registrierung und neutrale Meldungen', async ({ page }) => {
  await page.goto('/konto/');
  await expect(page).toHaveURL(/\/konto\/anmelden\//);

  await page.goto('/konto/registrieren/');
  await page.fill('input[name="email"]', `e2e-konto-${Date.now()}@example.com`);
  await page.fill('input[name="password"]', 'EinSicheresPasswort123');
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByText('Wenn die Adresse registriert werden kann')).toBeVisible();

  await page.goto('/konto/anmelden/');
  await page.fill('input[name="email"]', 'unbekannt@example.com');
  await page.fill('input[name="password"]', 'falschesPasswort1');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('E-Mail-Adresse oder Passwort ist nicht korrekt.')).toBeVisible();

  await page.goto('/konto/passwort-vergessen/');
  await page.fill('input[name="email"]', 'unbekannt@example.com');
  await page.getByRole('button', { name: 'Link anfordern' }).click();
  await expect(page.getByText('Wenn ein Konto existiert')).toBeVisible();
});
