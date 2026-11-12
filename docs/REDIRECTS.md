# 301-Weiterleitungen (Alt → Neu)

Alle alten WordPress-URLs werden dauerhaft (HTTP 301) auf die neuen Seiten umgeleitet. Die Umsetzung erfolgt in NGINX (siehe `deploy/nginx.conf.tpl`, Block „Weiterleitungen“).

| Alt | Neu | Anmerkung |
| --- | --- | --- |
| `/` | `/` | unverändert |
| `/3d-druck-rechner/` | `/3d-druck-rechner/` | unverändert |
| `/shop/` | `/shop/` | unverändert |
| `/produkt/recycling-box-mit-deckel-fuer-leere-batterien-zur-aufbewahrung-gebrauchter-batterien/` | `/shop/recycling-box-batterien/` | Produkt-Slug neu |
| `/produkt/<alle weiteren>/` | `/shop/` | Fallback für WooCommerce-Produkt-URLs |
| `/warenkorb/` | `/warenkorb/` | unverändert |
| `/kasse/` | `/kasse/` | unverändert |
| `/mein-konto/` | `/kontakt/` | Kundenkonten sind deaktiviert; Kontaktseite erklärt Abläufe |
| `/kontakt` | `/kontakt/` | alte Seite war 404 |
| `/versandarten/` | `/versand/` | kürzerer Slug |
| `/bezahlmoeglichkeiten/` | `/zahlung/` | kürzerer Slug |
| `/impressum/` | `/impressum/` | unverändert |
| `/agb/` | `/agb/` | unverändert |
| `/widerrufsbelehrung/` | `/widerruf/` | kürzerer Slug |
| `/cookie-richtlinie-eu/` | `/datenschutz/#cookies` | Cookie-Abschnitt in Datenschutz |
| `/echtheit-von-bewertungen/` | `/datenschutz/#bewertungen` | Seite war leer |
| `/hallo-welt/` | `/` | WordPress-Beispielbeitrag |
| `/startseite/feed/` | `/` | Feed |
| `/feed/` | `/` | Feed |
| `/shop/feed/` | `/shop/` | Feed |
| `/comments/feed/` | `/` | Feed |
| `/wp-sitemap.xml` | `/sitemap.xml` | neue Sitemap |
| `/wp-sitemap-posts-*` | `/sitemap.xml` | neue Sitemap |
| `/wp-json/*` | `/` | API nicht mehr öffentlich |
| `/wp-admin/*` | `/admin/` | neuer Admin-Login |
| `/xmlrpc.php` | `/` | abgeschaltet |
| `/wp-login.php` | `/admin/` | neuer Admin-Login |

## Regeln

- Kein `www`-Duplikat: `3d-mir.de` → `www.3d-mir.de` (kanonisch, per 301). **Zu bestätigen (F33).**
- HTTP → HTTPS: 301 (nur in Produktion mit Zertifikat).
- Alte Upload-URLs (`/wp-content/uploads/…`) werden nicht einzeln umgeleitet; sie laufen ins 404. Die neuen Bilder liegen unter `/assets/img/…`.
- Nach dem Umzug wird geprüft: `curl -I https://www.3d-mir.de/<alte-url>` liefert `301` mit korrektem `Location`.

## Umsetzung (Anwendung, Auszug)

Die Weiterleitungen sind in `src/routes/public.ts` (exakte Pfade) und `src/app.ts` (Präfixe wie `/wp-json/`, `/wp-admin/`, `/wp-sitemap-posts-`) umgesetzt. NGINX reicht alle Anfragen an die Anwendung durch; dadurch gelten die Regeln unabhängig vom Webserver und sind testbar.

```ts
const redirects = {
  '/versandarten/': '/versand/',
  '/bezahlmoeglichkeiten/': '/zahlung/',
  '/widerrufsbelehrung/': '/widerruf/',
  '/cookie-richtlinie-eu/': '/datenschutz/#cookies',
  '/echtheit-von-bewertungen/': '/datenschutz/#bewertungen',
  '/hallo-welt/': '/',
  '/mein-konto/': '/kontakt/',
  '/kontakt': '/kontakt/',
  // …
};
```

Präfixe in `src/app.ts`: `/wp-json/` → `/`, `/wp-admin/` → `/admin/`, `/wp-sitemap-posts-` → `/sitemap.xml`. Die alte Produkt-URL hat eine eigene 301-Regel; alle übrigen `/produkt/*`-URLs leiten auf `/shop/`.
