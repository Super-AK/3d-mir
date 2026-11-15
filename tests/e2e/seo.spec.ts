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
