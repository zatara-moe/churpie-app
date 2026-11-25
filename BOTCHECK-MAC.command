#!/bin/bash
# churpie · one-time: switch on the bot check (Cloudflare Turnstile), which stops scripts from making cards
# or sending messages. Double-click, or run in Terminal. The site key is already in wrangler.toml; this stores
# the secret key on the Worker that serves churpie.me. Nothing is changed unless every check passes.
cd "$(dirname "$0")"
export CI=
if [ ! -d node_modules/wrangler ]; then npm install --no-audit --no-fund || exit 1; fi
APP=$(grep -o 'APP_URL = "[^"]*"' wrangler.toml | head -1 | sed 's/APP_URL = "//; s/"//')
SITE=$(grep -o '^TURNSTILE_SITE_KEY = "[^"]*"' wrangler.toml | sed 's/^TURNSTILE_SITE_KEY = "//; s/"$//')
if [ -z "$SITE" ]; then echo "There's no site key in wrangler.toml yet. Add it there (TURNSTILE_SITE_KEY), push, then run this again."; exit 1; fi
if ! curl -s --max-time 20 "$APP/api/catalog" | grep -q "\"turnstile\":\"$SITE\""; then echo "$APP isn't serving the site key yet. Push in GitHub Desktop, run SHIP-MAC.command, then run this again."; exit 1; fi
echo "Site key $SITE is live on $APP. Two things to enter:"
echo
echo "1. The name of the Worker that serves churpie.me."
echo "   Cloudflare dashboard > Workers & Pages > the entry that shows churpie.me as its domain."
read -r -p "   Worker name (Return with nothing typed to stop): " WORKER
WORKER=$(printf '%s' "$WORKER" | tr -d '[:space:]')
[ -z "$WORKER" ] && { echo "Stopped. Nothing changed."; exit 0; }
if ! npx wrangler deployments list --name "$WORKER" >/dev/null 2>&1 < /dev/null; then echo "There's no Worker called '$WORKER' in this Cloudflare account. Nothing changed."; exit 1; fi
echo
echo "2. The widget's secret key: Cloudflare dashboard > Turnstile > churpie > Settings."
read -r -s -p "   Secret key (hidden as you paste; Return with nothing typed to stop): " SECRET; echo
SECRET=$(printf '%s' "$SECRET" | tr -d '[:space:]')
[ -z "$SECRET" ] && { echo "Stopped. Nothing changed."; exit 0; }
CHECK=$(curl -s --max-time 15 -d "secret=$SECRET" -d "response=churpie-setup-check" https://challenges.cloudflare.com/turnstile/v0/siteverify)
if [ -z "$CHECK" ] || printf '%s' "$CHECK" | grep -q 'invalid-input-secret'; then echo "Cloudflare didn't recognize that secret key. Nothing changed."; exit 1; fi
printf '%s' "$SECRET" | npx wrangler secret put TURNSTILE_SECRET --name "$WORKER" || { echo "The secret key could not be saved."; exit 1; }
unset SECRET
echo
echo "Done. The bot check is on for $APP (the secret key is stored only at Cloudflare)."
echo "Now make a test card on your phone and send one message, to see that real people get through."
echo "If anything gets in a real person's way: dashboard > that Worker > Settings > Variables and Secrets > delete TURNSTILE_SECRET, and it's off again."
