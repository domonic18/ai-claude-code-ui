#!/bin/bash
# 推送 Docker 镜像到腾讯云容器镜像服务
# 推送两个镜像：主应用镜像和运行时镜像

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

# 获取版本号
VERSION="$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)"

# 镜像名称
MAIN_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-ui:${VERSION}"
SANDBOX_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-sandbox:${VERSION}"

# 检查镜像是否存在
if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${MAIN_IMAGE}$"; then
  error "未找到主应用镜像: $MAIN_IMAGE"
  error "请先运行: ./scripts/build-image.sh"
  exit 1
fi

if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${SANDBOX_IMAGE}$"; then
  error "未找到沙箱镜像: $SANDBOX_IMAGE"
  error "请先运行: ./scripts/build-image.sh"
  exit 1
fi

echo ""
echo "=========================================="
info "  Pushing Docker Images"
echo "=========================================="
echo "Registry: $REGISTRY"
echo "=========================================="

# 登录镜像仓库
echo ""
read -p "登录腾讯云镜像仓库? [y/N]: " do_login
if [[ "$do_login" =~ ^[Yy]$ ]]; then
  info "登录腾讯云镜像仓库..."
  docker login "$REGISTRY"
fi

# 推送主应用镜像
echo ""
info "1/2 推送主应用镜像: $MAIN_IMAGE"
docker push "$MAIN_IMAGE"

# 推送沙箱镜像
echo ""
info "2/2 推送沙箱镜像: $SANDBOX_IMAGE"
docker push "$SANDBOX_IMAGE"

# 完成
echo ""
echo "======================================"
info "所有镜像推送完成！"
echo "======================================"
echo ""
info_msg "已推送的镜像："
echo "  主应用："
echo "    $MAIN_IMAGE"
echo ""
echo "  沙箱："
echo "    $SANDBOX_IMAGE"
echo ""
info_msg "部署流程："
echo ""
echo "  1. 新机器上拉取镜像："
echo "     docker pull ${MAIN_IMAGE}"
echo "     docker pull ${SANDBOX_IMAGE}"
echo ""
echo "  2. 新机器上创建 .env 文件，配置沙箱镜像："
echo "     CONTAINER_IMAGE=${SANDBOX_IMAGE}"
echo ""
echo "  3. 新机器上创建 docker-compose.yml："
echo "     services:"
echo "       app:"
echo "         image: ${MAIN_IMAGE}"
echo "         ..."
echo ""
echo "  4. 新机器上启动："
echo "     docker-compose up -d"
echo ""
info_msg "当前版本: ${VERSION}"
echo ""
