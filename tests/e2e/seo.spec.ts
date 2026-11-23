import { expect, test } from '@playwright/test';

test('SEO: robots.txt, Sitemap und Canonical', async ({ request, page }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-agent: *');
  expect(robotsText).toContain('Disallow: /admin/');
  expect(robotsText).toContain('Sitemap: https://www.3d-mir.de/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('<urlset');
  expect(sitemapText).toContain('https://www.3d-mir.de/shop/');
  expect(sitemapText).toContain('/shop/recycling-box-batterien/');

  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.3d-mir.de/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test('Favicon: ICO, PNG, Manifest und Links auf allen Seiten', async ({ request, page }) => {
  const ico = await request.get('/favicon.ico');
  expect(ico.status()).toBe(200);
  expect(ico.headers()['content-type']).toContain('image/x-icon');
  expect([...(await ico.body()).subarray(0, 4)]).toEqual([0, 0, 1, 0]);

  for (const [path, size] of [
    ['/favicon.png', 180],
    ['/apple-touch-icon.png', 180],
    ['/favicon-192.png', 192],
    ['/favicon-512.png', 512],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('image/png');
    expect((await response.body()).readUInt32BE(16), path).toBe(size);
  }

  const manifest = await request.get('/site.webmanifest');
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()['content-type']).toContain('application/manifest+json');
  const data = (await manifest.json()) as { icons: { src: string }[] };
  expect(data.icons[0]!.src).toContain('/favicon-192.png');
  expect(data.icons[1]!.src).toContain('/favicon-512.png');

  for (const path of ['/', '/kontakt/', '/leistungen/', '/3d-druck-rechner/', '/shop/', '/admin/login/']) {
    await page.goto(path);
    await expect(page.locator('link[rel="icon"]')).not.toHaveCount(0);
    await expect(page.locator('link[rel="shortcut icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/site\.webmanifest/);
  }
});

test('SEO: alte WordPress-Pfade leiten dauerhaft um', async ({ request }) => {
  for (const [path, target] of [
    ['/wp-json/wp/v2/posts', '/'],
    ['/wp-admin/', '/admin/'],
    ['/wp-sitemap-posts-post-1.xml', '/sitemap.xml'],
    ['/versandarten/', '/versand/'],
    ['/versandarten', '/versand/'],
    ['/bezahlmoeglichkeiten/', '/zahlung/'],
    ['/widerrufsbelehrung/', '/widerruf/'],
    ['/cookie-richtlinie-eu/', '/datenschutz/'],
    ['/mein-konto/', '/kontakt/'],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers()['location'], path).toContain(target);
  }
});
