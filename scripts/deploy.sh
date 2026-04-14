#!/bin/bash
# Deploy script for macOS server (Jenkins Agent)
# Used by Jenkins pipeline or manual deployment
#
# Usage:
#   ./scripts/deploy.sh <version>           # Deploy specific version
#   ./scripts/deploy.sh latest              # Deploy latest tag
#   ./scripts/deploy.sh --rollback <ver>    # Rollback to specific version
#
# Prerequisites on macOS server:
#   - Docker Desktop for Mac installed and running
#   - docker-compose available
#   - Project directory with docker-compose.deploy.yml and .env.deploy

set -euo pipefail

# ==================== Configuration ====================
DEPLOY_DIR="${DEPLOY_DIR:-/opt/claude-code-ui/deploy}"
HEALTH_PORT="${HEALTH_PORT:-3001}"
HEALTH_TIMEOUT=90  # seconds
STOP_TIMEOUT=30    # seconds for graceful shutdown

# ==================== Helper Functions ====================
info() { echo -e "\033[32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# ==================== Input Validation ====================
# VERSION 只允许 git short commit hash 格式（十六进制字符）或 "latest"
validate_version() {
    local ver="$1"
    if [ "$ver" = "latest" ]; then
        return 0
    fi
    # git short commit: 7-40 个十六进制字符
    if echo "$ver" | grep -qE '^[0-9a-f]{7,40}$'; then
        return 0
    fi
    error "Invalid VERSION: '${ver}'"
    error "VERSION must be 'latest' or a git commit hash (7-40 hex chars)"
    exit 1
}

validate_deploy_dir() {
    local dir="$1"
    # 拒绝路径遍历
    if echo "$dir" | grep -q '\.\.'; then
        error "DEPLOY_DIR contains path traversal ('..'): ${dir}"
        exit 1
    fi
    # 必须是绝对路径
    if [ "${dir:0:1}" != "/" ]; then
        error "DEPLOY_DIR must be an absolute path: ${dir}"
        exit 1
    fi
    # 只允许安全字符
    if ! echo "$dir" | grep -qE '^[a-zA-Z0-9_/\-.\s]+$'; then
        error "DEPLOY_DIR contains illegal characters: ${dir}"
        exit 1
    fi
}

validate_port() {
    local port="$1"
    if ! echo "$port" | grep -qE '^[0-9]+$'; then
        error "HEALTH_PORT must be a number: ${port}"
        exit 1
    fi
    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        error "HEALTH_PORT out of range (1-65535): ${port}"
        exit 1
    fi
}

# ==================== Parse Arguments ====================
ROLLBACK=false
VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --rollback)
      ROLLBACK=true
      shift
      ;;
    -h|--help)
      echo "Usage:"
      echo "  $0 <version>           Deploy specific version"
      echo "  $0 latest              Deploy latest tag"
      echo "  $0 --rollback <ver>    Rollback to specific version"
      echo ""
      echo "Environment variables:"
      echo "  DEPLOY_DIR    Project directory (default: /opt/claude-code-ui/deploy)"
      echo "  HEALTH_PORT   Health check port (default: 3001)"
      exit 0
      ;;
    *)
      VERSION="$1"
      shift
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  error "Version argument required"
  echo "Usage: $0 <version>"
  exit 1
fi

# ==================== Validate All Inputs ====================
validate_version "$VERSION"
validate_deploy_dir "$DEPLOY_DIR"
validate_port "$HEALTH_PORT"

HEALTH_CHECK_URL="http://localhost:${HEALTH_PORT}/health"

# ==================== Main Deployment ====================
cd "$DEPLOY_DIR"

MAIN_IMAGE="claude-code-ui:${VERSION}"
SANDBOX_IMAGE="claude-code-sandbox:${VERSION}"

echo ""
echo "=========================================="
if [ "$ROLLBACK" = true ]; then
  warn "  ROLLBACK Deployment"
else
  info "  Starting Deployment"
fi
echo "=========================================="
echo "Version:     ${VERSION}"
echo "Main image:  ${MAIN_IMAGE}"
echo "Sandbox:     ${SANDBOX_IMAGE}"
echo "Deploy dir:  ${DEPLOY_DIR}"
echo "=========================================="

# Step 1: Check prerequisites
info "1/5 Checking prerequisites..."
if [ ! -f docker-compose.deploy.yml ]; then
  error "docker-compose.deploy.yml not found in ${DEPLOY_DIR}"
  exit 1
fi
if [ ! -f .env.deploy ]; then
  error ".env.deploy not found in ${DEPLOY_DIR}"
  exit 1
fi

# Check if images exist locally
if ! docker image inspect "$MAIN_IMAGE" &>/dev/null; then
  error "Image not found: $MAIN_IMAGE"
  error "Please build the image first or verify the version"
  exit 1
fi
if ! docker image inspect "$SANDBOX_IMAGE" &>/dev/null; then
  error "Image not found: $SANDBOX_IMAGE"
  exit 1
fi

# Tag sandbox as latest for container runtime
docker tag "$SANDBOX_IMAGE" "claude-code-sandbox:latest"

# Step 2: Resolve docker-compose template
info "2/5 Resolving docker-compose template..."
export IMAGE_VERSION="$VERSION"
if command -v envsubst &>/dev/null; then
  # Only substitute IMAGE_VERSION, avoid replacing other variables (e.g. secrets in env refs)
  envsubst '${IMAGE_VERSION}' < docker-compose.deploy.yml > docker-compose.deploy.resolved.yml
else
  # macOS may not have envsubst, use sed as fallback
  # VERSION is validated to be hex-only, safe for sed replacement
  sed "s/\${IMAGE_VERSION}/${VERSION}/g" docker-compose.deploy.yml > docker-compose.deploy.resolved.yml
fi

# Step 3: Stop old containers
info "3/5 Stopping old containers (timeout: ${STOP_TIMEOUT}s)..."
docker-compose -f docker-compose.deploy.resolved.yml down --timeout "$STOP_TIMEOUT" 2>>"${DEPLOY_DIR}/deploy-debug.log" || true

# Step 4: Start new containers
info "4/5 Starting new containers..."
docker-compose -f docker-compose.deploy.resolved.yml up -d

# Step 5: Health check (with initial startup buffer)
info "5/5 Running health check (timeout: ${HEALTH_TIMEOUT}s)..."
# Wait 5 seconds before first check to give container time to start
sleep 5
elapsed=5
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
  if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
    info "Health check passed after ${elapsed}s"
    break
  fi
  sleep 5
  elapsed=$((elapsed + 5))
  echo "  Waiting... (${elapsed}s/${HEALTH_TIMEOUT}s)"
done

if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
  error "Health check FAILED after ${HEALTH_TIMEOUT}s"
  # Save logs to file instead of printing to console to avoid credential leakage
  docker-compose -f docker-compose.deploy.resolved.yml logs --tail 30 > "${DEPLOY_DIR}/deploy-failed.log" 2>&1
  error "Container logs saved to: ${DEPLOY_DIR}/deploy-failed.log"
  error "Please check the log file on the server for details"
  error "To rollback, run: $0 --rollback <previous-version>"
  exit 1
fi

# Cleanup old images
info "Cleaning up old images..."
docker image prune -f --filter "until=168h" 2>/dev/null || true

echo ""
echo "=========================================="
info "Deployment complete!"
echo "=========================================="
echo "Version:   ${VERSION}"
echo "Health:    OK"
echo ""
