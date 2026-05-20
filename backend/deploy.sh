#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  deploy.sh — Deploy KariGo Backend to GCP Compute Engine
#
#  Usage:
#    chmod +x deploy.sh          (first time only)
#    ./deploy.sh                 (deploy with default settings)
#    ./deploy.sh --no-env        (skip copying .env.production)
#    ./deploy.sh --build-only    (rsync + build, don't restart container)
#
#  Requirements (on your Mac):
#    - gcloud CLI installed & authenticated
#    - Docker NOT required locally (build happens on the VM)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────
GCP_PROJECT="aiseekho-496805"
GCP_ZONE="us-central1-c"
GCP_INSTANCE="instance-20260520-162334"
REMOTE_DIR="~/karigo-backend"
CONTAINER_NAME="karigo-backend"
IMAGE_NAME="karigo-backend"
PORT="3001"
ENV_FILE=".env.production"

# ── Flags ────────────────────────────────────────────────────────
COPY_ENV=true
BUILD_ONLY=false

for arg in "$@"; do
  case $arg in
    --no-env)    COPY_ENV=false ;;
    --build-only) BUILD_ONLY=true ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────
log()  { echo -e "\n\033[1;36m▶ $*\033[0m"; }
ok()   { echo -e "\033[1;32m✔ $*\033[0m"; }
warn() { echo -e "\033[1;33m⚠ $*\033[0m"; }
err()  { echo -e "\033[1;31m✖ $*\033[0m"; exit 1; }

# Find gcloud binary (handling cases where it's not in user PATH)
GCLOUD_BIN="gcloud"
if ! command -v gcloud &>/dev/null; then
  if [[ -f "/Users/umar/Desktop/google-cloud-sdk/bin/gcloud" ]]; then
    GCLOUD_BIN="/Users/umar/Desktop/google-cloud-sdk/bin/gcloud"
  else
    err "gcloud CLI not found. Please install it or ensure it is at /Users/umar/Desktop/google-cloud-sdk/bin/gcloud"
  fi
fi

gcloud() {
  "$GCLOUD_BIN" "$@"
}

gcloud_ssh() {
  gcloud compute ssh "$GCP_INSTANCE" \
    --project "$GCP_PROJECT" \
    --zone    "$GCP_ZONE" \
    --command "$1"
}

gcloud_scp() {
  # $1 = local, $2 = remote path (no instance prefix needed, added below)
  gcloud compute scp "$1" \
    "${GCP_INSTANCE}:$2" \
    --project "$GCP_PROJECT" \
    --zone    "$GCP_ZONE"
}

# ── Pre-flight ───────────────────────────────────────────────────
log "Pre-flight checks"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if $COPY_ENV && [[ ! -f "$ENV_FILE" ]]; then
  err "$ENV_FILE not found. Copy .env.production from the template and fill in your secrets."
fi

ok "Checks passed"

# ── Step 1: Ensure remote directory exists ───────────────────────
log "Step 1/5 — Ensure remote directory: $REMOTE_DIR"
gcloud_ssh "mkdir -p $REMOTE_DIR"
ok "Remote dir ready"

# ── Step 2: rsync source files ───────────────────────────────────
log "Step 2/5 — Syncing files to VM"

# Build an rsync-style exclude list via gcloud scp (scp doesn't support exclude,
# so we use a tar pipe through gcloud ssh for efficiency)
tar \
  --exclude='./node_modules' \
  --exclude='./runtime' \
  --exclude='./.env*' \
  --exclude='./test' \
  --exclude='./.git' \
  --exclude='./.DS_Store' \
  --exclude='./pnpm-lock.yaml' \
  --exclude='./nodemon.json' \
  -czf - . \
| gcloud compute ssh "$GCP_INSTANCE" \
    --project "$GCP_PROJECT" \
    --zone    "$GCP_ZONE" \
    -- "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"

ok "Source files synced"

# ── Step 3: Copy production env ──────────────────────────────────
if $COPY_ENV; then
  log "Step 3/5 — Copying $ENV_FILE → VM:.env"
  gcloud_scp "$ENV_FILE" "$REMOTE_DIR/.env"
  ok ".env copied"
else
  warn "Step 3/5 — Skipped env copy (--no-env)"
fi

# ── Step 4: Build Docker image on VM ────────────────────────────
log "Step 4/5 — Building Docker image on VM"
gcloud_ssh "cd $REMOTE_DIR && docker build -t $IMAGE_NAME ."
ok "Docker image built"

if $BUILD_ONLY; then
  warn "Step 5/5 — Skipped container restart (--build-only)"
  echo ""
  ok "Build complete. Run without --build-only to start the container."
  exit 0
fi

# ── Step 5: Stop old container and start new one ─────────────────
log "Step 5/5 — Restarting container"
gcloud_ssh "
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm   $CONTAINER_NAME 2>/dev/null || true
  docker run -d \
    --name $CONTAINER_NAME \
    --restart=always \
    -p $PORT:$PORT \
    --env-file $REMOTE_DIR/.env \
    $IMAGE_NAME
"
ok "Container started"

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo -e "\033[1;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[1;32m  ✅ KariGo Backend deployed successfully!\033[0m"
echo -e "\033[1;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo "  Useful commands:"
echo ""
echo "  Check logs:"
echo "    gcloud compute ssh $GCP_INSTANCE --project $GCP_PROJECT --zone $GCP_ZONE -- 'docker logs -f $CONTAINER_NAME'"
echo ""
echo "  Check status:"
echo "    gcloud compute ssh $GCP_INSTANCE --project $GCP_PROJECT --zone $GCP_ZONE -- 'docker ps'"
echo ""
echo "  Test health endpoint:"
echo "    gcloud compute ssh $GCP_INSTANCE --project $GCP_PROJECT --zone $GCP_ZONE -- 'curl -s http://localhost:$PORT/api/health'"
echo ""
