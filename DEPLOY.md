# churpie. — setup guide

Written for focus, not jargon. One step at a time. Every step has a checkbox.

**Total: about 40 minutes · 1 account (Cloudflare) · $5/month · nothing to maintain afterwards**

## Before you start

- [ ] A Cloudflare account (free to create at cloudflare.com; you already use it for R2)
- [ ] The `churpie` folder on your computer (this zip, unzipped)
- [ ] Node.js 20 or newer installed (nodejs.org, the LTS button)
- [ ] A terminal open **inside the churpie folder** (on a Mac: right-click the folder → New Terminal at Folder)

---

## Step 1 of 6 — install and log in (5 min)

- [ ] In the terminal: `npm install`
- [ ] Then: `npx wrangler login` (a browser tab opens; click Allow)
- [ ] Then: `npx wrangler whoami` — it should print your account name

## Step 2 of 6 — the database (3 min)

- [ ] `npx wrangler d1 create churpie`
- [ ] It prints a block with `database_id = "…"`. Copy that id.
- [ ] Open `wrangler.toml`, find `database_id = "REPLACE_AFTER_wrangler_d1_create"`, paste your id between the quotes. Save.
- [ ] `npm run db:remote` — creates the tables. You should see a ✅.

## Step 3 of 6 — the storage bucket (2 min)

- [ ] `npx wrangler r2 bucket create churpie-clips`
- [ ] Then in the Cloudflare dashboard: R2 → churpie-clips → Settings → **Object lifecycle rules** → Add rule:
  prefix `clips/`, delete after **31 days**. Add a second rule: prefix `finals/`, delete after **65 days**.
  (The app deletes on time by itself; these rules are the safety net so nothing can ever linger.)

## Step 4 of 6 — secrets and the first deploy (5 min)

- [ ] Make up a long password for the stitcher. Any 40 random characters. Save it in your notes as STITCH_TOKEN.
- [ ] `npx wrangler secret put STITCH_TOKEN` — paste it when asked.
- [ ] Open `wrangler.toml`, change `APP_URL = "http://localhost:8787"` to `APP_URL = "https://churpie.<your-subdomain>.workers.dev"` for now (you'll see the real address after the deploy; come back and fix it).
- [ ] `npm run deploy`
- [ ] It prints the address. Open it in your phone's browser. You should see the churpie home page.
- [ ] Fix `APP_URL` in `wrangler.toml` to match that address exactly, and `npm run deploy` once more.

## Step 5 of 6 — the stitcher (10 min)

The stitcher is the only piece that isn't a Cloudflare page. It needs FFmpeg, so it runs as a container. Pick one:

**Option A — Cloudflare Containers (no maintenance, inside the same $5 plan)**
- [ ] Dashboard → Workers & Pages → upgrade to **Workers Paid** ($5/month) if you haven't.
- [ ] Follow the Cloudflare Containers quick start with the `stitcher/` folder: it builds `stitcher/Dockerfile`.
- [ ] Set two environment variables on it: `APP_URL` (your address from Step 4) and `STITCH_TOKEN` (from your notes).
- [ ] Set it to run on a schedule (every 5 minutes) with `node stitch.js --once`, or keep it running with `node stitch.js`. Either way it sleeps between cards and you pay only for stitching seconds.

**Option B — your own laptop, for the Flagstaff test (free, today)**
- [ ] `brew install ffmpeg` (Mac) or download from ffmpeg.org (Windows)
- [ ] In the terminal: `cd stitcher`
- [ ] `APP_URL=https://your-address STITCH_TOKEN=your-token node stitch.js`
- [ ] Leave that window open. Every card anyone sends gets stitched by your laptop within 20 seconds. Close it when you're done; cards wait in line until it's back.

**Option C — any Docker host (Fly.io, Railway, a VPS)**
- [ ] Deploy `stitcher/` as a Docker image with the same two environment variables.

## Step 6 of 6 — your domain (5 min)

- [ ] Dashboard → Workers & Pages → churpie → Settings → Domains & Routes → Add → Custom domain → `app.churpie.me`
- [ ] Change `APP_URL` in `wrangler.toml` to `https://app.churpie.me` and `npm run deploy` one last time.
- [ ] Point `churpie.me` (the marketing site) wherever you like, or at the same Worker.

---

## Day-to-day

- **Nothing to restart, patch or babysit.** Pages, database and storage are managed by Cloudflare. The stitcher wakes and sleeps on its own.
- **To change copy or a color:** edit the file in `public/`, run `npm run deploy`. Thirty seconds.
- **To see what's happening:** dashboard → Workers & Pages → churpie → Logs. Or the `events` table in D1 (created / clip / sent / opened / saved / replied).
- **If a card says "something hiccuped while stitching":** the host has a Try again button. The stitcher logs say why.

## Optional, later

- **Email backups of links:** `npx wrangler secret put RESEND_API_KEY` after creating a free Resend account; wire-up is a small change in `src/index.js` (search for `RESEND`).
- **Bot check on uploads:** Cloudflare Turnstile, free; add the secret as `TURNSTILE_SECRET`.
- **Nunito in the reel text:** download the font (see `stitcher/fonts/README.md`) and rebuild the container. Until then the reel uses DejaVu, which is fine.
