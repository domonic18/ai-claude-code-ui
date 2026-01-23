#!/bin/bash
# 推送 Docker 镜像到腾讯云容器镜像服务

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

# ==================== 获取版本号 ====================
GIT_HASH=$(git rev-parse --short HEAD)

# 查找已有的版本镜像标签
EXISTING_TAG=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "${REGISTRY}/${NAMESPACE}/${PROJECT}:git_${GIT_HASH}_[0-9]\{14\}$" | head -1)

if [ -n "$EXISTING_TAG" ]; then
  VERSIONED_IMAGE="$EXISTING_TAG"
  VERSION="${EXISTING_TAG##*:}"
  info "检测到已构建的镜像版本: $VERSION"
else
  error "未检测到版本镜像"
  error "请先运行: ./scripts/build-image.sh"
  exit 1
fi

echo ""
echo "=========================================="
info "  Pushing Docker Image"
echo "=========================================="
echo "Registry: $REGISTRY"
echo "Namespace: $NAMESPACE"
echo "Project: $PROJECT"
echo "Version: $VERSION"
echo "=========================================="

# 登录镜像仓库
echo ""
read -p "Login to Tencent Cloud registry? [y/N]: " do_login
if [[ "$do_login" =~ ^[Yy]$ ]]; then
  info "登录腾讯云镜像仓库..."
  docker login "$REGISTRY"
fi

# 推送镜像
echo ""
info "推送镜像: $VERSIONED_IMAGE"
docker push "$VERSIONED_IMAGE"

# 完成
echo ""
echo "======================================"
info "镜像推送完成！版本号: $VERSION"
echo "======================================"
echo ""
info_msg "已推送的镜像："
echo "  $VERSIONED_IMAGE"
echo ""
info_msg "在目标机器上拉取镜像："
echo "  docker pull $VERSIONED_IMAGE"
echo ""
info_msg "修改 docker-compose.yml 中的 image 字段："
echo "  image: $VERSIONED_IMAGE"
echo ""
info_msg "然后启动服务："
echo "  docker-compose up -d"
echo ""
