#!/bin/bash
# churpie · churpie.me ships when you PUSH in GitHub Desktop (Cloudflare builds it from GitHub).
# Run this after a push: it waits until the live site matches this folder, then checks the pages. It changes nothing.
# Run TEST-LOCAL-MAC.command before you push. Results are also saved to .wrangler/ship.log
cd "$(dirname "$0")"
mkdir -p .wrangler; LOG=.wrangler/ship.log; : > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }
APP=$(grep -o 'APP_URL = "[^"]*"' wrangler.toml | head -1 | sed 's/APP_URL = "//; s/"//')
say "churpie ship check · $(date)"
if [ -n "$(git status --short 2>/dev/null)" ]; then say "  note  some changes in this folder aren't committed yet, so they aren't on their way:"; git status --short | head -12 | sed 's/^/        /' | tee -a "$LOG"; fi
if [ -n "$(git log --oneline '@{u}..HEAD' 2>/dev/null)" ]; then say "  note  there are commits that haven't been pushed. Push in GitHub Desktop, then run this again."; fi
FILES="index.html new.html host.html watch.html contribute.html admin.html privacy.html terms.html app.js llms.txt"
live_matches() { for f in $FILES; do p="/${f%.html}"; [ "$f" = "index.html" ] && p="/"; [ "$(curl -s --max-time 20 "$APP$p" | shasum)" = "$(shasum < "public/$f")" ] || return 1; done; return 0; }
say "waiting for $APP to match this folder (a build takes a minute or two)..."
OK=""
for i in $(seq 1 36); do if live_matches; then OK=1; break; fi; sleep 10; done
if [ -z "$OK" ]; then
  say "  CHECK $APP still differs from this folder after 6 minutes."
  say "        Look at the build in Cloudflare: Workers & Pages > the Worker that has churpie.me > Deployments."
  say "RESULT: NOT LIVE YET."; exit 1
fi
say "  ok    the live pages match this folder"
BAD=0
for p in / /new /privacy /terms /api/catalog; do
  C=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$APP$p")
  if [ "$C" = "200" ]; then say "  ok    $APP$p"; else say "  CHECK $APP$p (answered $C)"; BAD=1; fi
done
if curl -s --max-time 20 "$APP/api/catalog" | grep -q '"turnstile":"'; then say "  ok    bot check site key is live (it only checks people once the secret key is set: BOTCHECK-MAC.command)"; else say "  note  bot check is off"; fi
if [ "$BAD" = "0" ]; then say "RESULT: LIVE."; else say "RESULT: LIVE, but look at the CHECK lines above."; fi
