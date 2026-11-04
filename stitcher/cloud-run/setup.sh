#!/bin/bash
# churpie · puts the reel maker on Google Cloud Run's free tier. Run it once, in Google Cloud Shell:
#
#   git clone https://github.com/zatara-moe/churpie-app && bash churpie-app/stitcher/cloud-run/setup.sh
#
# It creates a Google Cloud project, turns on what Cloud Run needs, sets a $1 budget alert,
# and deploys the reel maker so it sleeps until churpie wakes it. Safe to run again: it updates in place.
set -euo pipefail

REGION="us-west1"            # Oregon: closest to Arizona, and in the free tier
SERVICE="churpie-stitcher"
APP_URL="https://churpie.me"
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # the stitcher folder

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
stop() { printf '\n%s\n' "$1"; exit 1; }

say "1/6  Your Google Cloud billing account"
BILLING="$(gcloud billing accounts list --filter=open=true --format='value(name)' | head -1 | sed 's#billingAccounts/##')"
[ -n "$BILLING" ] || stop "No billing account found. Add one at https://console.cloud.google.com/billing (a card is needed, but the free tier costs \$0), then run this again."
echo "     using billing account $BILLING"

say "2/6  The project"
PROJECT="$(gcloud projects list --filter='name=churpie-reels' --format='value(projectId)' | head -1)"
if [ -z "$PROJECT" ]; then
  PROJECT="churpie-reels-$(date +%s | tail -c 6)"
  gcloud projects create "$PROJECT" --name="churpie-reels" --quiet
fi
gcloud config set project "$PROJECT" --quiet >/dev/null
gcloud billing projects link "$PROJECT" --billing-account="$BILLING" --quiet >/dev/null
echo "     project $PROJECT"

say "3/6  Turning on Cloud Run (takes a minute)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com billingbudgets.googleapis.com --quiet

say "4/6  A \$1 budget alert, so any charge shows up long before it matters"
if ! gcloud billing budgets list --billing-account="$BILLING" --format='value(displayName)' 2>/dev/null | grep -qx "churpie reels"; then
  gcloud billing budgets create --billing-account="$BILLING" --display-name="churpie reels" \
    --budget-amount=1USD --threshold-rule=percent=0.5 --threshold-rule=percent=1.0 --quiet >/dev/null \
    && echo "     alert set: you'll get an email at 50 cents and at \$1" \
    || echo "     (couldn't set the alert here; set one at https://console.cloud.google.com/billing/budgets)"
else
  echo "     already set"
fi

say "5/6  The reel maker's key"
echo "     Paste the contents of STITCH_TOKEN.txt (in your churpie-2 folder), then press Return."
echo "     Nothing shows while you paste; that's on purpose."
read -rs TOKEN; echo
[ -n "$TOKEN" ] || stop "No key pasted. Run this again when you have STITCH_TOKEN.txt open."

say "6/6  Building and deploying the reel maker (5 to 10 minutes the first time)"
# asleep until woken; one reel at a time; never more than one copy running, so it can't run up a bill
gcloud run deploy "$SERVICE" --source "$HERE" --region "$REGION" \
  --cpu 2 --memory 2Gi --concurrency 1 --min-instances 0 --max-instances 1 --timeout 3600 \
  --allow-unauthenticated --set-env-vars "APP_URL=$APP_URL,STITCH_TOKEN=$TOKEN" --quiet
# keep only the newest copy of the reel maker's image, so storage stays tiny
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy --location "$REGION" --quiet \
  --policy=<(printf '[{"name":"keep-newest","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":1}},{"name":"delete-rest","action":{"type":"Delete"},"condition":{"tagState":"any"}}]') >/dev/null 2>&1 || true

# the code Google keeps from each update: delete after 7 days, so nothing piles up
for B in "gs://run-sources-${PROJECT}-${REGION}" "gs://${PROJECT}_cloudbuild"; do
  gcloud storage buckets update "$B" --lifecycle-file=<(printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":7}}]}') --quiet >/dev/null 2>&1 || true
done

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
STATUS="$(curl -s "$URL/" || true)"
printf '\n\033[1mDone.\033[0m The reel maker is asleep at:\n\n    %s\n\n(check: %s)\nSend that address to Claude. Nothing else to do here.\n\n' "$URL" "$STATUS"
