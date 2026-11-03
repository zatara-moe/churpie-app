# churpie.

a group video card that edits itself and plays like a reel.

One link to share. People open it on any phone, record 15 seconds (or upload, or write), no app, no account. The host previews, hides anything, taps send. A stitcher weaves one reel: blurred-fill framing (no black bars), leveled sound, music ducked under voices, name stickers, a title card with the prompt, an end card. The recipient opens an envelope, watches, saves it to their phone. Thirty days later everything is deleted.

## What's in here

```
src/            the whole app: one Cloudflare Worker (pages + API + nightly sweep)
public/         the pages: index, new, contribute, host, watch, gone  (plain HTML/JS, no build step)
migrations/     the D1 database schema (3 tables + events)
stitcher/       the FFmpeg worker: one Node file + Dockerfile. Runs anywhere.
DEPLOY.md       Step-by-step setup guide
```

## Run it on your laptop in two minutes

```bash
npm install
npm run db:local                       # creates the local database
echo "STITCH_TOKEN=dev-token" > .dev.vars
npm run dev                            # app at http://localhost:8787
# in a second terminal, the stitcher:
cd stitcher && APP_URL=http://localhost:8787 STITCH_TOKEN=dev-token node stitch.js
```

Needs Node 20+ and `ffmpeg` on your PATH for the stitcher (`brew install ffmpeg` on a Mac).

## How the pieces talk

```
phone ──PUT clip──▶ Worker ──▶ R2 (clips/<card>/<clip>.mp4)
                     │
host taps send ──▶  D1: card.status = queued
                     │
stitcher polls ──▶ POST /api/stitch/next  (claims the job)
                   GET  /api/stitch/object?key=…  (pulls each clip)
                   POST /api/stitch/flags/:clip   (quiet / short / dark)
                   PUT  /api/stitch/final/:card   (pushes reel.mp4 + manifest)
                     │
recipient ──▶ /w/<token> streams finals/<card>/reel.mp4 with range support
                     │
nightly cron ──▶ deletes raw clips 48h after the reel exists, deletes everything at day 30
```

The stitcher never holds storage keys or database access: one shared secret, `STITCH_TOKEN`. That's why it can run on a laptop, a free VM, or a pay-per-second container without changing a line.

## Links are the accounts

| Link | Who | What it does |
| --- | --- | --- |
| `/c/<id>` | everyone invited | opens on the camera |
| `/h/<host_token>` | the host only | the board: preview, hide, reorder, send, extend |
| `/w/<watch_token>` | the recipient | envelope, reel, save, reply |
| `/c/<id>?edit=<edit_token>` | one contributor | replace or remove their own clip before send |

Tokens are 24 characters from an alphabet with no 0/O/1/l, so they can be read aloud.

## Business detection

An email at a non-consumer domain (anything that isn't gmail, yahoo, icloud, outlook, …) marks the card `account_type = business`. That's the lead list for brand mode. Nothing else changes yet.

## Costs

Personal cards cost about a penny each (see the product brief). Fixed: Cloudflare Workers Paid $5/month, which includes D1, R2's first 10 GB, and the container minutes for stitching.
