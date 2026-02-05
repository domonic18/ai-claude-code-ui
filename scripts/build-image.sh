#!/bin/bash
# 构建 Docker 镜像脚本
# 三阶段构建：base -> 主应用镜像 -> 运行时镜像
#
# 使用方式：
#   ./scripts/build-image.sh              # 完整构建（包括 base）
#   ./scripts/build-image.sh --app-only   # 仅构建应用和运行时镜像
#   ./scripts/build-image.sh --rebuild-base # 强制重建 base 镜像

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

# 镜像名称
BASE_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-ui:base"
MAIN_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-ui:latest"
RUNTIME_IMAGE="${REGISTRY}/${NAMESPACE}/claude-code-runtime:latest"

# Dockerfile 路径
BASE_DOCKERFILE="docker/Dockerfile.base"
MAIN_DOCKERFILE="docker/Dockerfile.deploy"
RUNTIME_DOCKERFILE="docker/Dockerfile.runtime"

# 解析命令行参数
REBUILD_BASE=false
APP_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --rebuild-base)
      REBUILD_BASE=true
      shift
      ;;
    --app-only)
      APP_ONLY=true
      shift
      ;;
    -h|--help)
      echo "使用方式："
      echo "  $0                        # 完整构建（包括 base，如果不存在）"
      echo "  $0 --app-only             # 仅构建应用和运行时镜像"
      echo "  $0 --rebuild-base         # 强制重建 base 镜像"
      echo ""
      echo "镜像构建顺序："
      echo "  1. $BASE_IMAGE"
      echo "  2. $MAIN_IMAGE (基于 base)"
      echo "  3. $RUNTIME_IMAGE"
      exit 0
      ;;
    *)
      error "未知参数: $1"
      echo "使用 $0 --help 查看帮助"
      exit 1
      ;;
  esac
done

echo ""
echo "=========================================="
info "  Building Docker Images"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Registry: $REGISTRY"
echo "=========================================="

# ==================== 阶段 1: 基础镜像 ====================
BUILD_BASE=false

# 检查 base 镜像是否已存在（使用 docker image inspect 更可靠）
if docker image inspect "$BASE_IMAGE" &>/dev/null; then
  if [ "$REBUILD_BASE" = true ]; then
    info_msg "强制重建 base 镜像"
    BUILD_BASE=true
  else
    info_msg "base 镜像已存在，跳过构建（使用 --rebuild-base 强制重建）"
  fi
else
  info_msg "base 镜像不存在，需要构建"
  BUILD_BASE=true
fi

if [ "$APP_ONLY" = true ]; then
  info_msg "--app-only 模式，跳过 base 镜像构建"
  BUILD_BASE=false
fi

if [ "$BUILD_BASE" = true ]; then
  if [ ! -f "$BASE_DOCKERFILE" ]; then
    error "找不到 base Dockerfile: $BASE_DOCKERFILE"
    exit 1
  fi

  echo ""
  info "1/3 构建基础镜像 (base)..."
  docker build \
    -f "$BASE_DOCKERFILE" \
    -t "$BASE_IMAGE" \
    .

  info "基础镜像构建完成！"
  echo "  - $BASE_IMAGE"
fi

# ==================== 阶段 2: 主应用镜像 ====================
if [ ! -f "$MAIN_DOCKERFILE" ]; then
  error "找不到主应用 Dockerfile: $MAIN_DOCKERFILE"
  exit 1
fi

echo ""
info "2/3 构建主应用镜像 (claude-code-ui)..."
docker build \
  -f "$MAIN_DOCKERFILE" \
  -t "$MAIN_IMAGE" \
  .

info "主应用镜像构建完成！"
echo "  - $MAIN_IMAGE"

# ==================== 阶段 3: 运行时镜像 ====================
if [ ! -f "$RUNTIME_DOCKERFILE" ]; then
  error "找不到运行时 Dockerfile: $RUNTIME_DOCKERFILE"
  exit 1
fi

echo ""
info "3/3 构建运行时镜像 (claude-code-runtime)..."
docker build \
  -f "$RUNTIME_DOCKERFILE" \
  -t "$RUNTIME_IMAGE" \
  .

info "运行时镜像构建完成！"
echo "  - $RUNTIME_IMAGE"

# ==================== 完成 ====================
echo ""
echo "======================================"
info "所有镜像构建完成！"
echo "======================================"
echo ""
info_msg "已构建的镜像："
echo "  基础镜像："
echo "    $BASE_IMAGE"
echo ""
echo "  主应用："
echo "    $MAIN_IMAGE"
echo ""
echo "  运行时："
echo "    $RUNTIME_IMAGE"
echo ""
info_msg "下一步："
echo "  本地测试: ./scripts/deploy-test-image.sh"
echo "  推送镜像: ./scripts/push-image.sh"
echo ""
