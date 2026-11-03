#!/bin/bash
# churpie · runs the stitcher on this Mac. Leave the window open; close it when you're done.
cd "$(dirname "$0")/stitcher"
if [ ! -d node_modules/ffmpeg-static ] || [ ! -d node_modules/playwright ]; then
  echo "first run: installing the stitcher's tools (FFmpeg and a small browser for the card frames). about 2 minutes..."
  npm install --no-audit --no-fund || exit 1
  npx playwright install chromium || exit 1
fi
export APP_URL=$(cat ../APP_URL.txt) STITCH_TOKEN=$(cat ../STITCH_TOKEN.txt)
echo "stitching for $APP_URL"
node stitch.js
