-- churpie · D1 schema
-- One card = one reel. Clips belong to a card. Nothing here needs an account.

CREATE TABLE IF NOT EXISTS cards (
  id             TEXT PRIMARY KEY,          -- public id, in the invite link  /c/:id
  host_token     TEXT NOT NULL UNIQUE,      -- private key to the host board /h/:host_token
  watch_token    TEXT NOT NULL UNIQUE,      -- recipient link                 /w/:watch_token
  recipient_name TEXT NOT NULL,
  moment         TEXT NOT NULL,             -- birthday | congrats | thankyou | getwell | missyou | memory | team | brand
  vibe           TEXT NOT NULL DEFAULT 'confetti',
  prompt         TEXT NOT NULL,             -- the host's one question everyone answers
  tone           TEXT,                      -- funny | heartfelt | hype | quiet
  rules          TEXT,                      -- JSON array of short house rules
  host_name      TEXT NOT NULL,
  host_email     TEXT,
  host_intro_key TEXT,                      -- optional "hear Maria" clip in R2
  account_type   TEXT NOT NULL DEFAULT 'personal', -- personal | business (from the email domain)
  clip_seconds   INTEGER NOT NULL DEFAULT 15,      -- 15 or 30
  status         TEXT NOT NULL DEFAULT 'open',     -- open | queued | stitching | ready | sent | failed | expired
  final_key      TEXT,                      -- finals/:id/reel.mp4 once stitched
  manifest       TEXT,                      -- JSON from the stitcher: [{clipId,name,location,start,end,kind}]
  stitch_error   TEXT,
  deadline_at    TEXT,
  sent_at        TEXT,
  expires_at     TEXT,                      -- everything in R2 is deleted after this
  extended       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clips (
  id               TEXT PRIMARY KEY,
  card_id          TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  edit_token       TEXT NOT NULL UNIQUE,    -- lets the contributor replace or remove their own clip
  contributor_name TEXT NOT NULL,
  location         TEXT,                    -- optional "Phoenix, AZ"
  kind             TEXT NOT NULL DEFAULT 'video', -- video | text
  text             TEXT,                    -- for kind = text
  storage_key      TEXT,                    -- clips/:card_id/:id.(mp4|webm)
  content_type     TEXT,
  bytes            INTEGER,
  duration         REAL,
  status           TEXT NOT NULL DEFAULT 'uploading', -- uploading | ready | hidden | removed
  flags            TEXT,                    -- JSON: ["quiet","short","dark","noname"]
  position         INTEGER,                 -- host's order; NULL = arrival order
  loved            INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- one line per card event, so the first business pitch has real numbers
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    TEXT NOT NULL,
  type       TEXT NOT NULL,                 -- created | clip | sent | opened | saved | replied | extended | expired
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS clips_card_idx   ON clips(card_id, status);
CREATE INDEX IF NOT EXISTS cards_status_idx ON cards(status);
CREATE INDEX IF NOT EXISTS cards_expiry_idx ON cards(expires_at);
