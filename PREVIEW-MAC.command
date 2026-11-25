#!/bin/bash
# churpie · look at what's in this folder before it goes live. Double-click, or run in Terminal.
# Opens a private local copy at http://localhost:8787 with its own empty database. Nothing live is touched,
# no emails are sent, and card links show on screen instead of going to an inbox. Close this window to stop it.
cd "$(dirname "$0")"
export CI=true
PORT=8787; STATE=.wrangler/preview-state; LOG=.wrangler/preview.log
mkdir -p .wrangler; : > "$LOG"
if [ ! -d node_modules/wrangler ]; then echo "installing the app's packages (first run only)..."; npm install --no-audit --no-fund || exit 1; fi
npx wrangler d1 migrations apply churpie --local --persist-to "$STATE" >> "$LOG" 2>&1 < /dev/null || { echo "The preview database could not be set up. See $LOG"; exit 1; }
echo "starting the preview..."
npx wrangler dev --port $PORT --persist-to "$STATE" --var STITCH_TOKEN:dev-token --var APP_URL:http://localhost:$PORT --var STITCHER_URL:http://localhost:8798/run >> "$LOG" 2>&1 < /dev/null &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null; echo "STOPPED" >> "$LOG"' EXIT
for i in $(seq 1 60); do if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/api/catalog"; then echo "READY http://localhost:$PORT" >> "$LOG"; break; fi; sleep 1; done
if ! grep -q READY "$LOG"; then echo "The preview did not start. Last lines of its log:"; tail -20 "$LOG"; exit 1; fi
echo
echo "The preview is running at http://localhost:$PORT"
echo "Leave this window open while you look. Close it (or press Control-C) to stop."
open "http://localhost:$PORT" 2>/dev/null
wait $SERVER
