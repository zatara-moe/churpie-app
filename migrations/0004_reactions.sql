-- The recipient's video back to everyone: one per card, stored beside the reel and deleted with the card.
-- The Worker also makes this table on first use, so an existing site needs no database step.
CREATE TABLE IF NOT EXISTS reactions (
  card_id     TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
