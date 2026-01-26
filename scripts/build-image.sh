#!/bin/bash
# 构建 Docker 镜像脚本
# 构建两个镜像：主应用镜像和运行时镜像
# 镜像标签: latest

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

# 镜像名称（只有 latest 标签）
MAIN_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-ui:latest"
RUNTIME_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-runtime:latest"

# 检查 Dockerfile
MAIN_DOCKERFILE="docker/Dockerfile.deploy"
RUNTIME_DOCKERFILE="docker/Dockerfile.runtime"

if [ ! -f "$MAIN_DOCKERFILE" ]; then
  error "找不到主应用 Dockerfile: $MAIN_DOCKERFILE"
  exit 1
fi

if [ ! -f "$RUNTIME_DOCKERFILE" ]; then
  error "找不到运行时 Dockerfile: $RUNTIME_DOCKERFILE"
  exit 1
fi

echo ""
echo "=========================================="
info "  Building Docker Images"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Registry: $REGISTRY"
echo "=========================================="

# 构建主应用镜像
echo ""
info "1/2 构建主应用镜像 (claude-code-ui)..."
docker build \
  -f "$MAIN_DOCKERFILE" \
  -t "$MAIN_IMAGE" \
  .

info "主应用镜像构建完成！"
echo "  - $MAIN_IMAGE"

# 构建运行时镜像
echo ""
info "2/2 构建运行时镜像 (claude-code-runtime)..."
docker build \
  -f "$RUNTIME_DOCKERFILE" \
  -t "$RUNTIME_IMAGE" \
  .

info "运行时镜像构建完成！"
echo "  - $RUNTIME_IMAGE"

# 完成
echo ""
echo "======================================"
info "所有镜像构建完成！"
echo "======================================"
echo ""
info_msg "已构建的镜像："
echo "  主应用："
echo "    $MAIN_IMAGE"
echo ""
echo "  运行时："
echo "    $RUNTIME_IMAGE"
echo ""
info_msg "下一步："
echo "  推送镜像: ./scripts/push-image.sh"
echo ""
