#!/usr/bin/env bash
# ============================================================================
# export-from-mac.sh — 从旧 mac Docker 容器导出用户数据
#
# 在旧 mac 上执行，产出迁移包（workspace.tar.gz + auth-old.db + meta.json），
# 然后 scp 整个目录到 Linux 服务器。
#
# 前置条件：
#   - Docker 正在运行
#   - 用户容器 claude-user-2 存在（运行或停止均可，脚本会自动启动并恢复）
#   - 主应用容器 claude-code-app 存在（同上）
#   - 磁盘空间充足（数据量 x2 用于临时 tar）
#
# 用法：
#   chmod +x export-from-mac.sh
#   ./export-from-mac.sh                    # 使用默认值
#   ./export-from-mac.sh -u 2 -c claude-user-2 -o ./my-export
#
# 产出：
#   <output>/workspace.tar.gz   用户数据（排除运行时垃圾）
#   <output>/claude-code.db     旧数据库副本
#   <output>/meta.json          导出元数据
# ============================================================================

set -euo pipefail

# ---- 可配置参数 ----
OLD_USER_ID="${EXPORT_USER_ID:-2}"
SRC_USER_CONTAINER="${EXPORT_USER_CONTAINER:-claude-user-2}"
SRC_APP_CONTAINER="${EXPORT_APP_CONTAINER:-claude-code-app}"
OUT_DIR="${EXPORT_OUTPUT:-./data}"

# ---- 解析命令行参数 ----
while getopts "u:c:a:o:h" opt; do
  case "$opt" in
    u) OLD_USER_ID="$OPTARG" ;;
    c) SRC_USER_CONTAINER="$OPTARG" ;;
    a) SRC_APP_CONTAINER="$OPTARG" ;;
    o) OUT_DIR="$OPTARG" ;;
    h)
      echo "用法: $0 [-u user_id] [-c user_container] [-a app_container] [-o output_dir]"
      echo "  -u  旧用户 ID（默认: 2）"
      echo "  -c  用户容器名（默认: claude-user-2）"
      echo "  -a  主应用容器名（默认: claude-code-app）"
      echo "  -o  输出目录（默认: ./migration-export）"
      exit 0
      ;;
    *) exit 1 ;;
  esac
done

echo "============================================"
echo "  数据导出：旧 mac → 迁移包"
echo "============================================"
echo "用户容器:   $SRC_USER_CONTAINER"
echo "应用容器:   $SRC_APP_CONTAINER"
echo "旧用户 ID:  $OLD_USER_ID"
echo "输出目录:   $OUT_DIR"
echo "============================================"

# ---- 前置检查 ----

# 检查容器是否存在（不要求运行，docker ps -a 包含停止的容器）
container_exists() {
  docker ps -a --format '{{.Names}}' | grep -q "^${1}$"
}

# 确保容器运行，返回 "true"（需要恢复停止）或 "false"（本来就是跑着的）
ensure_running() {
  local name="$1"
  local status
  status=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  case "$status" in
    running) echo "false" ;;
    exited|stopped|paused)
      echo "  启动停止的容器: $name"
      docker start "$name" > /dev/null
      sleep 1  # 等容器就绪
      echo "true"
      ;;
    *)
      echo "错误：容器 '$name' 状态异常: $status" >&2; exit 1
      ;;
  esac
}

# 用临时容器从 volume 中提取用户数据（用户容器已删除时使用）
# 参数: $1=volume名  $2=输出tar文件路径
extract_from_volume() {
  local vol="$1"
  local tar_output="$2"
  echo "  使用临时容器从 volume 提取数据: $vol"
  docker run --rm \
    -v "$vol:/workspace:ro" \
    -v "$(dirname "$tar_output"):/output" \
    alpine tar czf /output/$(basename "$tar_output") -C /workspace \
    --exclude='./.claude/telemetry' \
    --exclude='./.claude/todos' \
    --exclude='./.claude/shell-snapshots' \
    --exclude='./.claude/debug' \
    --exclude='./.claude/backups' \
    --exclude='./.claude/statsig' \
    --exclude='./.claude/stats-cache.json' \
    --exclude='./.claude/session-env' \
    --exclude='./.npm' \
    --exclude='./.tmp' \
    .
}

# app 容器必须存在（数据库在里面）
if ! container_exists "$SRC_APP_CONTAINER"; then
  echo "错误：应用容器 '$SRC_APP_CONTAINER' 不存在，无法导出数据库。" >&2
  exit 1
fi

# 用户容器：存在就用它，不存在就从 volume 提取
USE_TMP_CONTAINER=false
if container_exists "$SRC_USER_CONTAINER"; then
  NEED_STOP_USER=$(ensure_running "$SRC_USER_CONTAINER")
else
  echo "  用户容器 '$SRC_USER_CONTAINER' 不存在，尝试从 volume 提取..."
  USE_TMP_CONTAINER=true
fi
NEED_STOP_APP=$(ensure_running "$SRC_APP_CONTAINER")

# 导完后恢复容器原状态
cleanup() {
  if [ "${NEED_STOP_USER:-false}" = "true" ]; then
    echo "  恢复容器状态: $SRC_USER_CONTAINER → stopped"
    docker stop "$SRC_USER_CONTAINER" > /dev/null 2>&1 || true
  fi
  if [ "${NEED_STOP_APP:-false}" = "true" ]; then
    echo "  恢复容器状态: $SRC_APP_CONTAINER → stopped"
    docker stop "$SRC_APP_CONTAINER" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

# ---- 步骤 1：打包 /workspace（排除运行时垃圾） ----
echo ""
echo "[1/3] 打包用户数据..."

if [ "$USE_TMP_CONTAINER" = "true" ]; then
  # 用户容器已删除，从 volume 提取
  # 尝试常见 volume 命名模式
  USER_VOL=""
  for vol_candidate in \
    "claude-user-$OLD_USER_ID-workspace" \
    "claude-user-data-$OLD_USER_ID" \
    "claude-code-user-$OLD_USER_ID"; do
    if docker volume inspect "$vol_candidate" &>/dev/null; then
      USER_VOL="$vol_candidate"
      break
    fi
  done
  if [ -z "$USER_VOL" ]; then
    echo "错误：找不到用户 $OLD_USER_ID 的数据 volume。" >&2
    echo "可用 volume：" >&2
    docker volume ls --format '{{.Name}}' | grep -i 'user\|claude' >&2 || echo "  (无匹配)" >&2
    echo "提示：用 -v <volume_name> 参数指定，或手动 docker volume ls 查找。" >&2
    exit 1
  fi
  extract_from_volume "$USER_VOL" "$OUT_DIR/workspace.tar.gz"
else
  # 正常：从用户容器内打包
  docker exec "$SRC_USER_CONTAINER" tar czf - -C /workspace \
    --exclude='./.claude/telemetry' \
    --exclude='./.claude/todos' \
    --exclude='./.claude/shell-snapshots' \
    --exclude='./.claude/debug' \
    --exclude='./.claude/backups' \
    --exclude='./.claude/statsig' \
    --exclude='./.claude/stats-cache.json' \
    --exclude='./.claude/session-env' \
    --exclude='./.npm' \
    --exclude='./.tmp' \
    . \
    > "$OUT_DIR/workspace.tar.gz"
fi

TAR_SIZE=$(du -sh "$OUT_DIR/workspace.tar.gz" | cut -f1)
echo "  打包完成: workspace.tar.gz ($TAR_SIZE)"

# ---- 步骤 2：拷出 claude-code.db ----
echo ""
echo "[2/3] 导出 claude-code.db..."

# 优先用 DATABASE_PATH 环境变量，回退到默认路径
DB_PATH=$(docker exec "$SRC_APP_CONTAINER" sh -c 'echo "${DATABASE_PATH:-}"' 2>/dev/null | tr -d '\r')
if [ -n "$DB_PATH" ]; then
  # 验证容器内该文件确实存在
  if ! docker exec "$SRC_APP_CONTAINER" test -f "$DB_PATH" 2>/dev/null; then
    echo "  警告：DATABASE_PATH=$DB_PATH 在容器内不存在，尝试回退路径" >&2
    DB_PATH=""
  fi
fi
if [ -z "$DB_PATH" ]; then
  # 尝试常见路径
  for candidate in \
    "/workspace/database/claude-code.db" \
    "/app/workspace/database/claude-code.db"; do
    if docker exec "$SRC_APP_CONTAINER" test -f "$candidate" 2>/dev/null; then
      DB_PATH="$candidate"
      break
    fi
  done
fi

if [ -z "$DB_PATH" ]; then
  echo "  警告：无法定位 claude-code.db，跳过账号导出" >&2
  echo "  请手动查找：docker exec $SRC_APP_CONTAINER find / -name claude-code.db -type f" >&2
  touch "$OUT_DIR/claude-code.db.MISSING"
else
  docker cp "$SRC_APP_CONTAINER:$DB_PATH" "$OUT_DIR/claude-code.db"
  echo "  导出完成: claude-code.db (路径: $DB_PATH)"
fi

# ---- 步骤 3：记录元数据 ----
echo ""
echo "[3/3] 记录元数据..."

# 采集项目列表（从容器 /workspace 下的顶层目录，排除 .开头和系统目录）
PROJECTS=$(docker exec "$SRC_USER_CONTAINER" sh -c \
  'ls -1d /workspace/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^\." | sort' | tr '\n' ',' | sed 's/,$//')

cat > "$OUT_DIR/meta.json" <<EOF
{
  "old_user_id": $OLD_USER_ID,
  "exported_from": "$SRC_USER_CONTAINER",
  "app_container": "$SRC_APP_CONTAINER",
  "export_time": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "projects": ["${PROJECTS//,/\",\"}"],
  "db_path": "${DB_PATH:-unknown}"
}
EOF

echo "  元数据已保存: meta.json"

# ---- 完成 ----
echo ""
echo "============================================"
echo "  导出完成！"
echo "============================================"
echo ""
echo "产出文件："
ls -lh "$OUT_DIR/"
echo ""
echo "下一步："
echo "  1. 将 $OUT_DIR 整个目录传输到 Linux 服务器："
echo "     scp -r $OUT_DIR user@linux-server:/tmp/"
echo ""
echo "  2. 在 Linux 上运行导入脚本："
echo "     ./import-to-linux.sh -i /tmp/migration-export"