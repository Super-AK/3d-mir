-- Herkunfts-IPs der API-Aufrufe protokollieren (für IP-Allowlists).
ALTER TABLE api_access_log ADD COLUMN ip TEXT NOT NULL DEFAULT '';
ALTER TABLE api_access_log ADD COLUMN forwarded_for TEXT NOT NULL DEFAULT '';
