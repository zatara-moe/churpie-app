#!/bin/bash
# churpie · one-time setup. Double-click this file, or run it in Terminal. Follow DEPLOY.md alongside it.
cd "$(dirname "$0")"
echo "1/5  installing the app's packages..."
npm install --no-audit --no-fund
echo "2/5  logging in to Cloudflare (a browser tab opens; click Allow)..."
npx wrangler login
npx wrangler whoami
echo "3/5  creating the database..."
npx wrangler d1 create churpie | tee /tmp/churpie-d1.txt
DBID=$(grep -o 'database_id = "[^"]*"' /tmp/churpie-d1.txt | head -1 | sed 's/database_id = "//; s/"//')
if [ -n "$DBID" ]; then sed -i '' "s/REPLACE_AFTER_wrangler_d1_create/$DBID/" wrangler.toml; echo "    database id saved: $DBID"; fi
npx wrangler d1 migrations apply churpie --remote
echo "4/5  creating the storage bucket..."
npx wrangler r2 bucket create churpie-clips
echo "5/5  setting the stitcher password and deploying..."
TOKEN=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 40)
echo "$TOKEN" > STITCH_TOKEN.txt
echo "$TOKEN" | npx wrangler secret put STITCH_TOKEN
npx wrangler deploy | tee /tmp/churpie-deploy.txt
URL=$(grep -o 'https://[a-z0-9.-]*workers.dev' /tmp/churpie-deploy.txt | head -1)
if [ -n "$URL" ]; then sed -i '' "s#APP_URL = \"http://localhost:8787\"#APP_URL = \"$URL\"#" wrangler.toml; npx wrangler deploy >/dev/null; echo; echo "churpie is live at: $URL"; echo "$URL" > APP_URL.txt; fi
echo
echo "Done. Your stitcher password is in STITCH_TOKEN.txt (keep it private)."
echo "To run the stitcher on this Mac:  ./STITCHER-MAC.command"
