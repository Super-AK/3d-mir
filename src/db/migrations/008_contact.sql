-- Kontaktnachrichten: Länderprüfung, Spam-Prüfung und Antworten aus dem Admin.
--
-- review_status:
--   ok      – Nachricht ist freigegeben und wurde an den Betreiber gemeldet
--   pruefen – Nachricht wartet auf manuelle Prüfung (kein Versand an den Betreiber)
--   spam    – Nachricht wurde als Spam eingestuft
ALTER TABLE contact_messages ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN review_status TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE contact_messages ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN replied_at TEXT;
ALTER TABLE contact_messages ADD COLUMN reply_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN reply_text TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_contact_review ON contact_messages(review_status, handled);
