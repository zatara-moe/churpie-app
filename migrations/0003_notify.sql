-- "Tell me when it's opened": the email a contributor leaves to hear back once. Deleted with the card.
-- The Worker also makes this table on first use, so an existing site needs no database step.
CREATE TABLE IF NOT EXISTS notify (
  clip_id    TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at    TEXT
);
CREATE INDEX IF NOT EXISTS notify_card_idx ON notify(card_id);
