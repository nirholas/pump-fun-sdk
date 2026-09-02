#!/usr/bin/env bash
# Rebuild this bot's .env from its deployed Cloud Run service.
#
#   ./recover-env.sh                 # writes .env, refuses to clobber one
#   ./recover-env.sh --force         # replaces an existing .env
#   PROJECT=my-project ./recover-env.sh
#
# Why this exists: .env is gitignored, so it is the one piece of this bot that
# does not survive a codespace rebuild. When it goes, the bot cannot be revived
# locally and deploy-cloudrun.sh cannot run either, because that script reads
# its whole configuration out of .env. The deployed revision is the durable
# copy: the non-secret keys live on the service and the token lives in Secret
# Manager. This reads both back and writes them into a fresh .env.
#
# It is the inverse of deploy-cloudrun.sh and deliberately mirrors it: same
# service, region, project and secret defaults, so overriding one there means
# overriding it here the same way.
#
# Requires: gcloud authenticated with run.viewer and secretmanager.secretAccessor
# on the target project.

set -euo pipefail

cd "$(dirname "$0")"

SERVICE="${SERVICE:-pumpfun-channel-bot}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
SECRET_NAME="${SECRET_NAME:-pumpfun-channel-bot-token}"
OUT="${OUT:-.env}"

FORCE=0
for arg in "$@"; do
    case "${arg}" in
        --force) FORCE=1 ;;
        # Print the leading comment block, however long it is, rather than a
        # hardcoded line range that drifts the moment the header is edited.
        -h|--help) awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
        *) echo "Unknown argument: ${arg}" >&2; exit 1 ;;
    esac
done

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
    echo "No GCP project set. Use: PROJECT=my-project $0" >&2
    exit 1
fi

if [[ -f "${OUT}" && "${FORCE}" -ne 1 ]]; then
    echo "${OUT} already exists. Re-run with --force to replace it." >&2
    exit 1
fi

# A dead refresh token fails several steps down with an opaque error, so say it
# here instead. This is the normal state after a codespace rebuild, and the fix
# is interactive: no flag or service account on this machine can substitute.
if ! gcloud auth print-access-token >/dev/null 2>&1; then
    echo "gcloud has no usable credentials (token refresh failed)." >&2
    echo "Run 'gcloud auth login' first; it needs a browser and cannot be scripted." >&2
    exit 2
fi

echo "Project: ${PROJECT}   Service: ${SERVICE}   Region: ${REGION}"

SPEC="$(mktemp -t recover-env-XXXXXX.json)"
trap 'rm -f "${SPEC}"' EXIT

if ! gcloud run services describe "${SERVICE}" \
        --project "${PROJECT}" --region "${REGION}" \
        --format=json > "${SPEC}" 2>/dev/null; then
    echo "Cloud Run service '${SERVICE}' not found in ${PROJECT}/${REGION}." >&2
    echo "Nothing to recover from: fill in .env from .env.example and deploy with ./deploy-cloudrun.sh" >&2
    exit 3
fi

# Plain env vars ship as {name, value}; the token ships as a secretKeyRef and is
# fetched separately below. Anything else with a valueFrom is reported rather
# than silently dropped, so a future secret cannot go missing unnoticed.
mapfile -t PLAIN < <(jq -r '
    .spec.template.spec.containers[0].env // []
    | .[] | select(.value != null) | "\(.name)=\(.value)"' "${SPEC}")

mapfile -t SECRET_REFS < <(jq -r '
    .spec.template.spec.containers[0].env // []
    | .[] | select(.value == null)
    | "\(.name)\t\(.valueFrom.secretKeyRef.name)\t\(.valueFrom.secretKeyRef.key // "latest")"' "${SPEC}")

if [[ "${#PLAIN[@]}" -eq 0 && "${#SECRET_REFS[@]}" -eq 0 ]]; then
    echo "The live revision declares no environment variables. Refusing to write an empty ${OUT}." >&2
    exit 3
fi

REVISION="$(jq -r '.status.latestReadyRevisionName // "unknown"' "${SPEC}")"

TMP_ENV="$(mktemp -t recover-env-out-XXXXXX)"
trap 'rm -f "${SPEC}" "${TMP_ENV}"' EXIT
chmod 600 "${TMP_ENV}"

{
    echo "# Recovered from Cloud Run service ${SERVICE} (revision ${REVISION})"
    echo "# Project ${PROJECT}, region ${REGION}, on $(date -u '+%Y-%m-%d %H:%M UTC')."
    echo "# Regenerate with ./recover-env.sh --force. Do not commit this file."
    echo
} >> "${TMP_ENV}"

for secret in "${SECRET_REFS[@]}"; do
    [[ -z "${secret}" ]] && continue
    key="$(cut -f1 <<< "${secret}")"
    ref="$(cut -f2 <<< "${secret}")"
    version="$(cut -f3 <<< "${secret}")"
    [[ "${version}" == "null" || -z "${version}" ]] && version="latest"
    echo "Fetching ${key} from Secret Manager (${ref}:${version})"
    if ! value="$(gcloud secrets versions access "${version}" \
            --secret "${ref}" --project "${PROJECT}" 2>/dev/null)"; then
        echo "Could not read secret '${ref}' (needs roles/secretmanager.secretAccessor)." >&2
        exit 4
    fi
    printf '%s=%s\n' "${key}" "${value}" >> "${TMP_ENV}"
done

for pair in "${PLAIN[@]}"; do
    [[ -z "${pair}" ]] && continue
    printf '%s\n' "${pair}" >> "${TMP_ENV}"
done

# The same guard deploy-cloudrun.sh enforces on the way out. A handle here would
# deploy cleanly and then post nothing, or post to the wrong channel.
CHANNEL="$(grep -E '^CHANNEL_ID=' "${TMP_ENV}" | head -1 | cut -d= -f2-)"
if [[ ! "${CHANNEL}" =~ ^-100[0-9]+$ ]]; then
    echo "Recovered CHANNEL_ID is not a numeric -100... id: '${CHANNEL}'" >&2
    echo "The live service is misconfigured; fix it there before trusting this file." >&2
    exit 5
fi

mv "${TMP_ENV}" "${OUT}"
chmod 600 "${OUT}"
trap 'rm -f "${SPEC}"' EXIT

echo
echo "Wrote ${OUT} ($(grep -cE '^[A-Z_0-9]+=' "${OUT}") keys, mode 0600) from revision ${REVISION}."
echo "Revive locally:  npm install && npm run build && npm start"
echo "Redeploy:        PROJECT=${PROJECT} ./deploy-cloudrun.sh"
