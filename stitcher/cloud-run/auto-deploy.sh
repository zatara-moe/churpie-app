#!/bin/bash
# churpie · one-time: after this, pressing Push in GitHub Desktop also updates the reel maker (when its files changed).
# Run it in Google Cloud Shell, after connecting GitHub in Cloud Build (see the steps Claude gave you):
#
#   bash <(curl -s https://raw.githubusercontent.com/zatara-moe/churpie-app/main/stitcher/cloud-run/auto-deploy.sh)
#
set -euo pipefail
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
stop() { printf '\n%s\n' "$1"; exit 1; }

PROJECT="$(gcloud projects list --filter='name=churpie-reels' --format='value(projectId)' | head -1)"
[ -n "$PROJECT" ] || stop "Couldn't find the churpie-reels project. Make sure you're signed in to the same Google account as the reel maker."
gcloud config set project "$PROJECT" --quiet >/dev/null
NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
say "1/3  Project $PROJECT"

say "2/3  Letting Cloud Build put new versions of the reel maker live"
gcloud services enable cloudbuild.googleapis.com --quiet
for SA in "${NUM}@cloudbuild.gserviceaccount.com" "${NUM}-compute@developer.gserviceaccount.com"; do
  for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None --quiet >/dev/null 2>&1 || true
  done
done
echo "     done"

say "3/3  The trigger: a push to main that changes stitcher/ rebuilds the reel maker"
if gcloud builds triggers describe churpie-reel-maker >/dev/null 2>&1; then
  echo "     already set up"
else
  gcloud builds triggers create github --name=churpie-reel-maker \
    --repo-owner=zatara-moe --repo-name=churpie-app --branch-pattern='^main$' \
    --build-config=stitcher/cloudbuild.yaml --included-files='stitcher/**' \
    --service-account="projects/$PROJECT/serviceAccounts/${NUM}-compute@developer.gserviceaccount.com" --quiet \
    || stop "Couldn't create the trigger. Most likely GitHub isn't connected yet: Cloud Build → Repositories (1st gen) → Connect repository → GitHub → zatara-moe/churpie-app. Then run this again."
fi

say "Putting the newest reel maker live now (about 5 to 10 minutes)"
gcloud builds triggers run churpie-reel-maker --branch=main --quiet >/dev/null && echo "     started. Watch it at https://console.cloud.google.com/cloud-build/builds?project=$PROJECT"
printf '\n\033[1mDone.\033[0m From now on, Push in GitHub Desktop updates the reel maker by itself.\n\n'
