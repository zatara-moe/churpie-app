# churpie stitcher · FFmpeg + headless Chromium (for the card frames). Runs on Cloudflare Containers, Fly.io, Railway, a VPS, or a laptop.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json stitch.js render.js ./
COPY cards ./cards
COPY music ./music
COPY assets ./assets
COPY fonts ./fonts
RUN npm install --omit=dev --no-audit --no-fund
ENV NODE_ENV=production POLL_SECONDS=20
# APP_URL and STITCH_TOKEN come from the host's environment
CMD ["node", "stitch.js"]
