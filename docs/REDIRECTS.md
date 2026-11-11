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
| `/mein-konto/` | `/konto/` | Konto (optional, Phase 6) |
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
| `/xmlrpc.php` | `/` | abgeschaltet |
| `/wp-login.php` | `/admin` | neuer Admin-Login |
| `/wp-admin/*` | `/admin` | neuer Admin-Login |

## Regeln

- Kein `www`-Duplikat: `3d-mir.de` → `www.3d-mir.de` (kanonisch, per 301). **Zu bestätigen (F33).**
- HTTP → HTTPS: 301 (nur in Produktion mit Zertifikat).
- Alte Upload-URLs (`/wp-content/uploads/…`) werden nicht einzeln umgeleitet; sie laufen ins 404. Die neuen Bilder liegen unter `/assets/img/…`.
- Nach dem Umzug wird geprüft: `curl -I https://www.3d-mir.de/<alte-url>` liefert `301` mit korrektem `Location`.

## Umsetzung (Nginx, Auszug)

```nginx
location = /versandarten/            { return 301 /versand/; }
location = /bezahlmoeglichkeiten/    { return 301 /zahlung/; }
location = /widerrufsbelehrung/      { return 301 /widerruf/; }
location = /cookie-richtlinie-eu/    { return 301 /datenschutz/#cookies; }
location = /echtheit-von-bewertungen/ { return 301 /datenschutz/#bewertungen; }
location = /hallo-welt/              { return 301 /; }
location = /kontakt                  { return 301 /kontakt/; }
location ^~ /produkt/                { return 301 /shop/; }
location = /produkt/recycling-box-mit-deckel-fuer-leere-batterien-zur-aufbewahrung-gebrauchter-batterien/ {
    return 301 /shop/recycling-box-batterien/;
}
```
