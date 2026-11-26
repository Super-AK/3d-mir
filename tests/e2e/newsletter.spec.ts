import { expect, test } from '@playwright/test';

test('Newsletter-Anmeldung ist neutral und erfordert Einwilligung', async ({ page }) => {
  await page.goto('/newsletter/');
  await expect(page.getByRole('heading', { name: 'Newsletter' })).toBeVisible();
  const checkbox = page.locator('input[name="consent"]');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();

  await page.fill('input[name="email"]', `e2e-newsletter-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('Wenn die Anmeldung möglich ist')).toBeVisible();
});
