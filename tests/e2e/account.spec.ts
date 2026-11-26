import { expect, test } from '@playwright/test';

test('Kontolink in Navigation und schmale Login-Karte', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-nav .nav-account')).toBeVisible();
  await expect(page.locator('.site-footer a[href="/konto/"]')).toBeVisible();

  await page.goto('/konto/');
  await expect(page).toHaveURL(/\/konto\/anmelden\//);
  const card = page.locator('.account-auth-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(600);
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
