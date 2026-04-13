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

set -e

# ==================== Configuration ====================
DEPLOY_DIR="${DEPLOY_DIR:-/Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-deploy}"
HEALTH_CHECK_URL="http://localhost:3001/health"
HEALTH_TIMEOUT=90  # seconds
STOP_TIMEOUT=30    # seconds for graceful shutdown

# ==================== Helper Functions ====================
info() { echo -e "\033[32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

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
      echo "  DEPLOY_DIR    Project directory (default: /opt/claude-code-ui)"
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
  error "镜像不存在: $MAIN_IMAGE"
  error "请先构建镜像或确认版本号正确"
  exit 1
fi
if ! docker image inspect "$SANDBOX_IMAGE" &>/dev/null; then
  error "镜像不存在: $SANDBOX_IMAGE"
  exit 1
fi

# Tag sandbox as latest for container runtime
docker tag "$SANDBOX_IMAGE" "claude-code-sandbox:latest"

# Step 2: Resolve docker-compose template
info "2/5 Resolving docker-compose template..."
export IMAGE_VERSION="$VERSION"
if command -v envsubst &>/dev/null; then
  envsubst < docker-compose.deploy.yml > docker-compose.deploy.resolved.yml
else
  # macOS may not have envsubst, use sed as fallback
  sed "s/\${IMAGE_VERSION}/${VERSION}/g" docker-compose.deploy.yml > docker-compose.deploy.resolved.yml
fi

# Step 3: Stop old containers
info "3/5 Stopping old containers (timeout: ${STOP_TIMEOUT}s)..."
docker-compose -f docker-compose.deploy.resolved.yml down --timeout "$STOP_TIMEOUT" 2>/dev/null || true

# Step 4: Start new containers
info "4/5 Starting new containers..."
docker-compose -f docker-compose.deploy.resolved.yml up -d

# Step 5: Health check
info "5/5 Running health check (timeout: ${HEALTH_TIMEOUT}s)..."
elapsed=0
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
  error "Container logs:"
  docker-compose -f docker-compose.deploy.resolved.yml logs --tail 30
  echo ""
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
echo "URL:       http://localhost:3001"
echo ""
