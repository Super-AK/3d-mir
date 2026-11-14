-- Versandkosten und Lieferzeiten wurden am 14.11.2026 bestätigt.
-- Falls im Admin zuvor Veröffentlichungseinstellungen gespeichert wurden,
-- steht dort noch shippingStatus = PLATZHALTER und überlagert die neue
-- Grundeinstellung aus config/pricing.json. Einmalig auf FINAL setzen.
UPDATE settings
SET value = json_set(value, '$.shippingStatus', 'FINAL'),
    updated_at = datetime('now')
WHERE key = 'publication.settings'
  AND json_valid(value)
  AND json_extract(value, '$.shippingStatus') = 'PLATZHALTER';
