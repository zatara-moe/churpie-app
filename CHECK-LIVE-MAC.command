#!/bin/bash
# churpie · is churpie.me showing what was last shipped from this folder? Double-click, or run in Terminal.
# Changes nothing. Results are also saved to .wrangler/check-live.log
cd "$(dirname "$0")"
export CI=true
mkdir -p .wrangler; LOG=.wrangler/check-live.log; : > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }
APP=$(grep -o 'APP_URL = "[^"]*"' wrangler.toml | head -1 | sed 's/APP_URL = "//; s/"//')
DEV=$(grep -o 'https://[a-z0-9.-]*workers\.dev' .wrangler/ship.log 2>/dev/null | head -1)
say "churpie live check · $(date)"; say "live address: $APP"; say "worker address: ${DEV:-unknown (run SHIP-MAC.command once)}"
sum() { curl -s --max-time 20 "$1" | shasum | cut -c1-12; }
for p in /privacy /llms.txt /sitemap.xml /terms /app.js; do
  L=$(shasum < "public${p%/}$( [ -f "public$p" ] || echo .html )" 2>/dev/null | cut -c1-12)
  A=$(sum "$APP$p"); D=$( [ -n "$DEV" ] && sum "$DEV$p" )
  say "$(printf '%-14s folder %s   worker %s   live %s   %s' "$p" "$L" "${D:--}" "$A" "$( [ "$A" = "$L" ] && echo same || echo DIFFERENT )")"
done
say; say "--- how churpie.me answers"
for p in /terms /privacy /llms.txt; do say "$APP$p"; curl -s -o /dev/null -D - --max-time 20 "$APP$p" | grep -i -E '^(HTTP|cf-cache-status|age|cache-control|last-modified|etag|server|cf-ray|location)' | sed 's/^/    /' | tee -a "$LOG"; done
say; say "--- where churpie.me points"; (dig +short "${APP#https://}" 2>/dev/null | head -4 | sed 's/^/    /') | tee -a "$LOG"
say; say "--- latest deployments of the worker named in wrangler.toml"
npx wrangler deployments list 2>&1 < /dev/null | tail -24 | tee -a "$LOG"
say; say "--- bot check on $APP"
# an empty request makes no card either way: refused as "not a person" (403) means the check is on; a plain "who's it for?" (400) means it's off
C=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST -H 'content-type: application/json' -d '{}' "$APP/api/cards")
if [ "$C" = "403" ]; then say "    ON: requests without a person check are refused"; elif [ "$C" = "400" ]; then say "    OFF: nothing is being checked yet (run BOTCHECK-MAC.command)"; else say "    unclear (answered $C)"; fi
say; say "RESULT: done."
