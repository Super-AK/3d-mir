import { expect, test } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL ?? '';
const password = process.env.E2E_ADMIN_PASSWORD ?? '';

test.describe('API & Schnittstellen', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');

  test('Token anlegen, API aufrufen und Freigaben ändern', async ({ page, request }) => {
    test.setTimeout(120_000);

    await page.goto('/admin/login/');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/$/);

    await page.goto('/admin/api/');
    await expect(page.getByRole('heading', { name: 'API & Schnittstellen' })).toBeVisible();
    await expect(page.getByText('Beispielantwort')).toBeVisible();

    await page.getByRole('link', { name: 'API-Hilfe' }).click();
    await expect(page.getByRole('heading', { name: 'API-Hilfe' })).toBeVisible();
    const openapi = await page.request.get('/admin/api/dokument/openapi/');
    expect(openapi.status()).toBe(200);
    expect(await openapi.text()).toContain('openapi: 3.1.0');
    await page.goto('/admin/api/');

    await page.fill('input[name="name"]', 'E2E API-Token');
    await page.check('input[name="scope"][value="orders:read"]');
    await page.locator('form[action="/admin/api/tokens/"] button[type="submit"]').click();
    const token = (await page.locator('.alert-success code').innerText()).trim();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const headers = { authorization: `Bearer ${token}` };

    const health = await request.get('/api/v1/health', { headers });
    expect(health.status()).toBe(200);
    expect((await health.json()).version).toBe('1.0.0');

    const orders = await request.get('/api/v1/orders?limit=2', { headers });
    expect(orders.status()).toBe(200);
    const list = (await orders.json()) as { data: unknown[]; has_more: boolean; next_cursor: string | null };
    expect(Array.isArray(list.data)).toBe(true);
    expect(typeof list.has_more).toBe('boolean');

    const initialMeta = await (await request.get('/api/v1/meta', { headers })).json();
    expect(JSON.stringify(initialMeta)).toContain('customer_snapshot.phone');

    await page.goto('/admin/api/');
    await page.uncheck('input[name="field_phone"]');
    await page.locator('form[action="/admin/api/"] button[type="submit"]').click();
    await expect(page).toHaveURL(/gespeichert=1/);

    const changedMeta = await (await request.get('/api/v1/meta', { headers })).json();
    expect(JSON.stringify(changedMeta)).not.toContain('customer_snapshot.phone');

    await page.goto('/admin/api/');
    await page.locator('form[action="/admin/api/reset/"] button[type="submit"]').click();
    await expect(page).toHaveURL(/zurueckgesetzt=1/);
    const restoredMeta = await (await request.get('/api/v1/meta', { headers })).json();
    expect(JSON.stringify(restoredMeta)).toContain('customer_snapshot.phone');

    await page.goto('/admin/api/');
    const tokenRow = page.locator('tr').filter({ hasText: 'E2E API-Token' });
    await tokenRow.locator('form[action$="/delete/"] button').click();
    await expect(page).toHaveURL(/geloescht=1/);
  });

  test('API ohne Token verweigert den Zugriff', async ({ request }) => {
    const response = await request.get('/api/v1/orders');
    expect(response.status()).toBe(401);
    expect(response.headers()['x-request-id']).toMatch(/^req_/);
  });
});
