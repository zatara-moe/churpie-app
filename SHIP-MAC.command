#!/bin/bash
# churpie · ship what's in this folder to churpie.me, then check the live site. Double-click, or run in Terminal.
# Asks nothing. Run TEST-LOCAL-MAC.command first. Results are also saved to .wrangler/ship.log
cd "$(dirname "$0")"
export CI=true
mkdir -p .wrangler; LOG=.wrangler/ship.log; : > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }
APP=$(grep -o 'APP_URL = "[^"]*"' wrangler.toml | head -1 | sed 's/APP_URL = "//; s/"//')
say "churpie ship · $(date)"
if [ ! -d node_modules/wrangler ]; then say "installing the app's packages..."; npm install --no-audit --no-fund >> "$LOG" 2>&1 || { say "RESULT: could not install packages."; exit 1; }; fi
if ! npx wrangler whoami >> "$LOG" 2>&1 < /dev/null; then say "RESULT: not logged in to Cloudflare. Run 'npx wrangler login' in this folder, then run this again."; exit 1; fi
say "shipping to $APP ..."
npx wrangler deploy 2>&1 < /dev/null | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" != "0" ]; then say "RESULT: the deploy did not go through. Nothing changed on the live site."; exit 1; fi
say "checking the live site..."
BAD=0
for p in / /new /privacy /terms /api/catalog; do
  C=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$APP$p")
  if [ "$C" = "200" ]; then say "  ok    $APP$p"; else say "  CHECK $APP$p (answered $C)"; BAD=1; fi
done
if curl -s --max-time 20 "$APP/terms" | grep -q 'the terms, in plain words'; then say "  ok    the new terms page is live"; else say "  CHECK the terms page is not showing the new text yet"; BAD=1; fi
if curl -s --max-time 20 "$APP/api/catalog" | grep -q '"turnstile":"'; then say "  ok    bot check is on"; else say "  note  bot check is off (BOTCHECK-MAC.command switches it on)"; fi
if [ "$BAD" = "0" ]; then say "RESULT: SHIPPED."; else say "RESULT: SHIPPED, but look at the CHECK lines above."; fi
