#!/bin/bash
# 构建 Docker 镜像脚本
# 镜像标签格式: git_<commit-hash>_<YYYYMMDDHHMMSS>

set -e

# 辅助函数
info() { echo -e "\033[32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[33m[WARN]\033[0m $1"; }
error() { echo -e "\033[31m[ERROR]\033[0m $1"; }
info_msg() { echo -e "\033[36m>>>\033[0m $1"; }

# 获取脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ==================== 腾讯云配置 ====================
REGISTRY="ccr.ccs.tencentyun.com"
NAMESPACE="patent"
PROJECT="claude-code-ui"

# ==================== 生成版本号 ====================
GIT_HASH=$(git rev-parse --short HEAD)
BUILD_DATE=$(date +"%Y%m%d%H%M%S")
VERSION="git_${GIT_HASH}_${BUILD_DATE}"

# 远程镜像名称
VERSIONED_IMAGE="${REGISTRY}/${NAMESPACE}/${PROJECT}:${VERSION}"

# 检查 Dockerfile
DOCKERFILE="docker/Dockerfile.production"
if [ ! -f "$DOCKERFILE" ]; then
  error "找不到 Dockerfile: $DOCKERFILE"
  exit 1
fi

echo ""
echo "=========================================="
info "  Building Docker Image"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Git Hash: $GIT_HASH"
echo "Build Date: $BUILD_DATE"
echo "Version: $VERSION"
echo "=========================================="

# 构建镜像
info "开始构建镜像..."
docker build \
  -f "$DOCKERFILE" \
  -t "$VERSIONED_IMAGE" \
  .

# 完成
echo ""
echo "======================================"
info "镜像构建完成！版本号: $VERSION"
echo "======================================"
echo ""
info_msg "已构建的镜像："
echo "  $VERSIONED_IMAGE"
echo ""
info_msg "下一步："
echo "  推送镜像: ./scripts/push-image.sh"
echo ""
