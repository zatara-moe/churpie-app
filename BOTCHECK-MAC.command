#!/bin/bash
# churpie · one-time: switch on the bot check (Cloudflare Turnstile), which stops scripts from making cards
# or sending messages. Double-click, or run in Terminal. You paste the widget's keys; it checks them, saves them and ships.
cd "$(dirname "$0")"
if [ ! -d node_modules/wrangler ]; then npm install --no-audit --no-fund || exit 1; fi
SITE=$(grep -o '^TURNSTILE_SITE_KEY = "[^"]*"' wrangler.toml | sed 's/^TURNSTILE_SITE_KEY = "//; s/"$//')
if [ -n "$SITE" ]; then
  echo "The site key is already saved in wrangler.toml ($SITE). Only the secret key is needed."
  echo "It's on the same Cloudflare page as the site key: Turnstile > churpie > Settings."
else
  echo "You need two keys from Cloudflare (free, about a minute). A browser tab is opening:"
  echo "  Turnstile > Add widget > name it churpie, hostname churpie.me, mode Managed > Create"
  open "https://dash.cloudflare.com/?to=/:account/turnstile" 2>/dev/null
  read -r -p "Site key (Return with nothing typed to stop): " SITE
  SITE=$(printf '%s' "$SITE" | tr -d '[:space:]')
  [ -z "$SITE" ] && { echo "Stopped. Nothing changed."; exit 0; }
  if ! printf '%s' "$SITE" | grep -Eq '^[0-9A-Za-z_-]{10,}$'; then echo "That site key doesn't look right. Nothing changed."; exit 1; fi
  NEWSITE=1
fi
read -r -s -p "Secret key (hidden as you paste; Return with nothing typed to stop): " SECRET; echo
SECRET=$(printf '%s' "$SECRET" | tr -d '[:space:]')
[ -z "$SECRET" ] && { echo "Stopped. Nothing changed."; exit 0; }
CHECK=$(curl -s --max-time 15 -d "secret=$SECRET" -d "response=churpie-setup-check" https://challenges.cloudflare.com/turnstile/v0/siteverify)
if [ -z "$CHECK" ] || printf '%s' "$CHECK" | grep -q 'invalid-input-secret'; then echo "Cloudflare didn't recognize that secret key. Nothing changed."; exit 1; fi
printf '%s' "$SECRET" | npx wrangler secret put TURNSTILE_SECRET || { echo "The secret key could not be saved. Nothing else changed."; exit 1; }
unset SECRET
if [ -n "$NEWSITE" ]; then sed -i '' "s/^TURNSTILE_SITE_KEY = \"\"/TURNSTILE_SITE_KEY = \"$SITE\"/" wrangler.toml; fi
echo "Saved: the site key in wrangler.toml, the secret key only at Cloudflare. Shipping..."
./SHIP-MAC.command
echo "Now make a test card on your phone and send one message, to see that real people get through."
