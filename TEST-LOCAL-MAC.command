#!/bin/bash
# churpie · test what's in this folder on this Mac before shipping. Double-click, or run in Terminal.
# It starts a private local copy of the app (its own empty database, nothing live is touched), walks one
# whole card through it, and prints what passed. Results are also saved to .wrangler/local-test.log
cd "$(dirname "$0")"
export CI=true
PORT=8799; STATE=.wrangler/test-state; LOG=.wrangler/local-test.log
mkdir -p .wrangler; : > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }
say "churpie local test · $(date)"
if [ ! -d node_modules/wrangler ]; then say "installing the app's packages (first run only)..."; npm install --no-audit --no-fund >> "$LOG" 2>&1 || { say "RESULT: could not install packages. See $LOG"; exit 1; }; fi
rm -rf "$STATE"
say "setting up an empty test database..."
npx wrangler d1 migrations apply churpie --local --persist-to "$STATE" >> "$LOG" 2>&1 < /dev/null || { say "RESULT: the test database could not be set up. See $LOG"; exit 1; }
say "starting the local copy on port $PORT..."
# email and the reel maker both point at a stand-in inside the test, so nothing is really sent and nothing live is woken
npx wrangler dev --port $PORT --persist-to "$STATE" --test-scheduled --var STITCH_TOKEN:dev-token --var APP_URL:http://localhost:$PORT --var RESEND_API_KEY:test --var RESEND_URL:http://localhost:8798/emails --var STITCHER_URL:http://localhost:8798/run --var NOTIFY_AFTER_MINUTES:0 > .wrangler/local-test-server.log 2>&1 < /dev/null &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null' EXIT
UP=""
for i in $(seq 1 60); do if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/api/catalog"; then UP=1; break; fi; sleep 1; done
if [ -z "$UP" ]; then say "RESULT: the local copy did not start. Last lines of its log:"; tail -20 .wrangler/local-test-server.log | tee -a "$LOG"; exit 1; fi
node tools/local-smoke.mjs "http://localhost:$PORT" dev-token 8798 2>&1 | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" = "0" ]; then say "RESULT: PASS. Safe to push in GitHub Desktop."; else say "RESULT: FAIL. Don't ship yet."; fi
