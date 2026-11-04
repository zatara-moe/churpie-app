#!/bin/bash
# churpie · double-click to put what's in this folder on churpie.me.
# It saves to GitHub first and only deploys if that worked, so the live site always matches GitHub.
cd "$(dirname "$0")" || exit 1
stop() { echo ""; echo "$1"; echo "Press any key to close."; read -n1; exit 1; }

[ -z "$(git status --porcelain)" ] || stop "There are unsaved changes in this folder (see GitHub Desktop). Commit or discard them first. Nothing was deployed."
[ "$(git branch --show-current)" = "main" ] || stop "This folder isn't on main. Switch to main in GitHub Desktop first. Nothing was deployed."

echo "1/2  Saving to GitHub..."
git push -q || stop "Couldn't save to GitHub, so nothing was deployed. Try Push in GitHub Desktop, then run this again."

echo "2/2  Deploying to churpie.me..."
[ -d node_modules ] || npm install --silent
npm run deploy || stop "The deploy didn't finish. Nothing on GitHub changed; run this again to retry."

echo ""
echo "Done. Open https://churpie.me to check. Press any key to close."
read -n1
