#!/usr/bin/env bash
# Deploy the PumpFun channel bot to Google Cloud Run.
#
#   ./deploy-cloudrun.sh
#
# Reads configuration from .env in this directory, stores the Telegram token in
# Secret Manager, and deploys a single always-on instance. Re-running it is a
# safe redeploy: the secret is versioned, not duplicated.
#
# Requires: gcloud authenticated (`gcloud auth login`) with run.admin,
# secretmanager.admin and cloudbuild.builds.editor on the target project.

set -euo pipefail

cd "$(dirname "$0")"

SERVICE="${SERVICE:-pumpfun-channel-bot}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
SECRET_NAME="${SECRET_NAME:-pumpfun-channel-bot-token}"

# One checkout serves several feeds. Each feed is its own Cloud Run service with
# its own bot token, channel and FEED_* toggles, so the config it ships lives in
# its own env file rather than in this script. Overriding all four variables is
# what deploys a sibling feed without disturbing the one already running:
#
#   SERVICE=pumpfun-claims-bot SECRET_NAME=pumpfun-claims-bot-token \
#     ENV_FILE=.env.claims ./deploy-cloudrun.sh
ENV_FILE="${ENV_FILE:-.env}"

# The project's default compute service account was deleted, so both the build
# and the runtime identity must be pinned explicitly or the deploy fails with an
# opaque permissions error.
BUILD_SA="${BUILD_SA:-three-ws-build@${PROJECT}.iam.gserviceaccount.com}"
RUNTIME_SA="${RUNTIME_SA:-three-ws@${PROJECT}.iam.gserviceaccount.com}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
    echo "No GCP project set. Use: PROJECT=my-project $0" >&2
    exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "No ${ENV_FILE} found in $(pwd). Copy .env.example and fill it in first." >&2
    exit 1
fi

# Pull the token out of the env file; everything else ships as plain env vars.
TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
if [[ -z "${TOKEN}" ]]; then
    echo "TELEGRAM_BOT_TOKEN is not set in ${ENV_FILE}" >&2
    exit 1
fi

# This bot must never post to the all-claims channel. A numeric -100... id is
# also the only form that survives a chat username change, and getChat by
# @handle is not reliable across chat types.
CHANNEL="$(grep -E '^CHANNEL_ID=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
if [[ ! "${CHANNEL}" =~ ^-100[0-9]+$ ]]; then
    echo "CHANNEL_ID must be the numeric -100... chat id, got: '${CHANNEL}'" >&2
    echo "Recover it with: curl -s \"https://api.telegram.org/bot\${TOKEN}/getChat?chat_id=@handle\"" >&2
    exit 1
fi

echo "Project: ${PROJECT}   Service: ${SERVICE}   Region: ${REGION}   Config: ${ENV_FILE}"
echo "Channel: ${CHANNEL}   Build SA: ${BUILD_SA}   Runtime SA: ${RUNTIME_SA}"

# Store (or rotate) the bot token in Secret Manager.
if gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT}" >/dev/null 2>&1; then
    printf '%s' "${TOKEN}" | gcloud secrets versions add "${SECRET_NAME}" \
        --data-file=- --project "${PROJECT}" >/dev/null
    echo "Secret ${SECRET_NAME}: new version added"
else
    printf '%s' "${TOKEN}" | gcloud secrets create "${SECRET_NAME}" \
        --data-file=- --replication-policy=automatic --project "${PROJECT}" >/dev/null
    echo "Secret ${SECRET_NAME}: created"
fi

# Grant the runtime identity read access on the secret, every time. Creating a
# secret does not grant anything, so the FIRST deploy of a new feed used to die
# after a full container build with "Permission denied on secret ...", which
# reads like a broken deploy config rather than a one-line IAM gap. The binding
# is idempotent, so re-running it on an existing secret is a no-op.
gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "${PROJECT}" >/dev/null
echo "Secret ${SECRET_NAME}: ${RUNTIME_SA} can read it"

# Every non-secret key from .env becomes a runtime env var. This goes through
# a YAML file, not --set-env-vars: values here legitimately contain commas
# (SOLANA_RPC_URLS is a comma-separated list) and "@" (CHANNEL_ID), so both the
# default comma separator and the ^@^ alternate-delimiter trick would corrupt
# them. Quoting every value as a YAML string is the only lossless path.
ENV_YAML="$(mktemp -t channel-bot-env-XXXXXX.yaml)"
trap 'rm -f "${ENV_YAML}"' EXIT

while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ "${line}" =~ ^[[:space:]]*# || -z "${line// }" ]] && continue
    [[ "${line}" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -z "${key}" ]] && continue
    # The token ships from Secret Manager, and PORT is reserved by Cloud Run:
    # including it makes the deploy fail outright. The container already reads
    # process.env.PORT, which Cloud Run injects to match --port.
    [[ "${key}" == "TELEGRAM_BOT_TOKEN" || "${key}" == "PORT" ]] && continue
    # Escape double quotes for YAML, then emit a quoted scalar.
    printf '%s: "%s"\n' "${key}" "${value//\"/\\\"}" >> "${ENV_YAML}"
done < "${ENV_FILE}"

echo "Shipping $(wc -l < "${ENV_YAML}") env vars (token comes from Secret Manager, PORT from Cloud Run)"

# Typecheck before uploading. The image build runs `tsc`, so a type error here
# would otherwise surface ~6 minutes later as an opaque "Build failed".
echo "Typechecking..."
npm run typecheck

# Deploy from a snapshot, not from the live directory. Other agents edit this
# worktree concurrently, and `gcloud run deploy --source .` uploads files one by
# one: an edit landing mid-upload ships a torn tree that fails to compile in
# Cloud Build even though the source on disk is fine. Copying first makes the
# build context atomic with respect to those edits.
STAGE="$(mktemp -d -t channel-bot-src-XXXXXX)"
trap 'rm -f "${ENV_YAML}"; rm -rf "${STAGE}"' EXIT
cp -a package.json tsconfig.json Dockerfile .dockerignore .gcloudignore src "${STAGE}/"
echo "Staged build context at ${STAGE}"

# --min-instances 1 + --no-cpu-throttling keep the websocket subscription alive
# between requests; a scale-to-zero service would drop the feed. --max-instances 1
# keeps it a singleton so the channel never receives duplicate posts.
gcloud run deploy "${SERVICE}" \
    --source "${STAGE}" \
    --project "${PROJECT}" \
    --region "${REGION}" \
    --platform managed \
    --build-service-account "projects/${PROJECT}/serviceAccounts/${BUILD_SA}" \
    --service-account "${RUNTIME_SA}" \
    --min-instances 1 \
    --max-instances 1 \
    --no-cpu-throttling \
    --memory 2Gi \
    --port 3000 \
    --no-allow-unauthenticated \
    --env-vars-file "${ENV_YAML}" \
    --set-secrets "TELEGRAM_BOT_TOKEN=${SECRET_NAME}:latest"

echo
echo "Deployed. Logs:"
echo "  gcloud run services logs tail ${SERVICE} --region ${REGION} --project ${PROJECT}"
echo "Stats (service is private, so mint a token):"
echo "  curl -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" \\"
echo "    \$(gcloud run services describe ${SERVICE} --region ${REGION} --project ${PROJECT} --format='value(status.url)')/stats"
