-- Churpie database schema
-- Paste this entire file into the Supabase SQL editor and run it

-- ─── Tables ───────────────────────────────────────────────────────

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade,
  slug text unique not null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  theme text default 'getwell',
  contributor_message text,
  music_choice text default 'gentle-piano',
  captions_enabled boolean default true,
  status text default 'live',
  -- status: live | compiling | compiled | sent | failed
  deadline_at timestamptz,
  compiled_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists clips (
  id text primary key,
  card_id uuid references cards(id) on delete cascade,
  contributor_name text,
  storage_key text not null,
  duration_seconds integer default 15,
  status text default 'uploading',
  -- status: uploading | submitted
  caption_text text,
  created_at timestamptz default now()
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade unique,
  watch_token text,
  compiled_video_key text,
  status text default 'pending',
  -- status: pending | compiling | compiled | sent | failed
  sent_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────

create index if not exists cards_creator_id_idx on cards(creator_id);
create index if not exists cards_slug_idx on cards(slug);
create index if not exists clips_card_id_idx on clips(card_id);
create index if not exists clips_status_idx on clips(status);

-- ─── Row Level Security ───────────────────────────────────────────

alter table cards enable row level security;
alter table clips enable row level security;
alter table deliveries enable row level security;
alter table replies enable row level security;

-- Cards: only the creator can read/update their own cards
create policy "creators can manage their cards"
  on cards for all
  using (creator_id = auth.uid());

-- Clips: anyone can INSERT into a live card (contributor flow — no auth)
-- but only the creator can SELECT all clips for their card
create policy "anyone can submit clips to live cards"
  on clips for insert
  with check (
    exists (
      select 1 from cards
      where id = clips.card_id
      and status = 'live'
    )
  );

create policy "creators can view clips on their cards"
  on clips for select
  using (
    exists (
      select 1 from cards
      where id = clips.card_id
      and creator_id = auth.uid()
    )
  );

-- Deliveries: only the creator sees delivery info
create policy "creators can view their deliveries"
  on deliveries for all
  using (
    exists (
      select 1 from cards
      where id = deliveries.card_id
      and creator_id = auth.uid()
    )
  );

-- Replies: recipients send via service key (no auth), creators can read
create policy "creators can view replies"
  on replies for select
  using (
    exists (
      select 1 from cards
      where id = replies.card_id
      and creator_id = auth.uid()
    )
  );

-- ─── Worker callback: update card/delivery status after compile ───
-- The Railway worker calls this via the service key (bypasses RLS)
-- No additional policies needed — service key has full access
