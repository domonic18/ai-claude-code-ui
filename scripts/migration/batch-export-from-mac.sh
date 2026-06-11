#!/usr/bin/env bash
# ============================================================================
# batch-export-from-mac.sh — 从旧 mac 批量导出多个用户数据
#
# 在旧 mac 上执行，产出批量迁移包。每个用户独立目录，DB 共享一份。
#
# 前置条件：
#   - Docker 正在运行
#   - 各用户容器 claude-user-{id} 存在（运行或停止均可）
#   - 主应用容器 claude-code-app 存在
#   - 磁盘空间充足（数据量 x 用户数）
#
# 用法：
#   chmod +x batch-export-from-mac.sh
#   ./batch-export-from-mac.sh -u "2,5,6,8,9,10,11,12,14"
#   ./batch-export-from-mac.sh -u "2,5,6" -a claude-code-app -o ./batch-export
#
# 产出：
#   <output>/manifest.json          批量元数据
#   <output>/claude-code.db         旧数据库（一份）
#   <output>/users/<id>/workspace.tar.gz
#   <output>/users/<id>/meta.json
# ============================================================================

set -euo pipefail

# ---- 可配置参数 ----
USER_IDS=""
SRC_APP_CONTAINER="${EXPORT_APP_CONTAINER:-claude-code-app}"
OUT_DIR="${EXPORT_OUTPUT:-./batch-export}"

# ---- 解析命令行参数 ----
usage() {
  echo "用法: $0 -u <用户ID列表> [-a app_container] [-o output_dir]"
  echo "  -u  旧用户 ID 列表，逗号分隔（必填，如 \"2,5,6,8\"）"
  echo "  -a  主应用容器名（默认: claude-code-app）"
  echo "  -o  输出目录（默认: ./batch-export）"
  echo "  -h  显示帮助"
  exit 0
}

while getopts "u:a:o:h" opt; do
  case "$opt" in
    u) USER_IDS="$OPTARG" ;;
    a) SRC_APP_CONTAINER="$OPTARG" ;;
    o) OUT_DIR="$OPTARG" ;;
    h) usage ;;
    *) exit 1 ;;
  esac
done

# 校验必填参数
if [ -z "$USER_IDS" ]; then
  echo "错误：必须指定用户 ID 列表（-u 参数）" >&2
  echo "示例: $0 -u \"2,5,6,8,9,10,11,12,14\"" >&2
  exit 1
fi

# 解析用户 ID 列表（逗号分隔 → 数组）
IFS=',' read -ra UID_LIST <<< "$USER_IDS"

# 校验每个 ID 为纯数字
for uid in "${UID_LIST[@]}"; do
  uid=$(echo "$uid" | xargs)  # 去空格
  if ! [[ "$uid" =~ ^[0-9]+$ ]]; then
    echo "错误：用户 ID 必须为纯数字，收到: '$uid'" >&2
    exit 1
  fi
done
# 去空格后重新赋值
CLEAN_IDS=()
for uid in "${UID_LIST[@]}"; do
  CLEAN_IDS+=("$(echo "$uid" | xargs)")
done
UID_LIST=("${CLEAN_IDS[@]}")

echo "============================================"
echo "  批量数据导出：旧 mac → 迁移包"
echo "============================================"
echo "用户 ID 列表: ${UID_LIST[*]}"
echo "用户数量:     ${#UID_LIST[@]}"
echo "应用容器:     $SRC_APP_CONTAINER"
echo "输出目录:     $OUT_DIR"
echo "============================================"

# ---- 辅助函数 ----

# 检查容器是否存在
container_exists() {
  docker ps -a --format '{{.Names}}' | grep -q "^${1}$"
}

# 确保容器运行
ensure_running() {
  local name="$1"
  local status
  status=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  case "$status" in
    running) echo "false" ;;
    exited|stopped|paused)
      echo "  启动停止的容器: $name"
      docker start "$name" > /dev/null
      sleep 1
      echo "true"
      ;;
    *)
      echo "错误：容器 '$name' 状态异常: $status" >&2
      exit 1
      ;;
  esac
}

# 用临时容器从 volume 中提取用户数据（stdout 管道写文件，避免挂载目录权限问题）
extract_from_volume() {
  local vol="$1"
  local tar_output="$2"
  echo "    使用临时容器从 volume 提取: $vol"
  docker run --rm \
    -v "$vol:/workspace:ro" \
    alpine tar czf - -C /workspace \
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
    > "$tar_output"
}

# ---- 前置检查：app 容器必须存在 ----
if ! container_exists "$SRC_APP_CONTAINER"; then
  echo "错误：应用容器 '$SRC_APP_CONTAINER' 不存在，无法导出数据库。" >&2
  exit 1
fi

NEED_STOP_APP=$(ensure_running "$SRC_APP_CONTAINER")

# 记录需要恢复状态的容器
STOPPED_CONTAINERS=()

cleanup() {
  for c in ${STOPPED_CONTAINERS[@]+"${STOPPED_CONTAINERS[@]}"}; do
    echo "  恢复容器状态: $c → stopped"
    docker stop "$c" > /dev/null 2>&1 || true
  done
  if [ "${NEED_STOP_APP:-false}" = "true" ]; then
    echo "  恢复容器状态: $SRC_APP_CONTAINER → stopped"
    docker stop "$SRC_APP_CONTAINER" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

mkdir -p "$OUT_DIR/users"

# ---- 步骤 1：拷出 claude-code.db（共享，只做一次） ----
echo ""
echo "[1/2] 导出 claude-code.db（共享）..."

DB_PATH=$(docker exec "$SRC_APP_CONTAINER" sh -c 'echo "${DATABASE_PATH:-}"' 2>/dev/null | tr -d '\r')
if [ -n "$DB_PATH" ]; then
  if ! docker exec "$SRC_APP_CONTAINER" test -f "$DB_PATH" 2>/dev/null; then
    DB_PATH=""
  fi
fi
if [ -z "$DB_PATH" ]; then
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
  echo "错误：无法定位 claude-code.db" >&2
  exit 1
fi

docker cp "$SRC_APP_CONTAINER:$DB_PATH" "$OUT_DIR/claude-code.db"
echo "  导出完成: claude-code.db (路径: $DB_PATH)"

# ---- 步骤 2：逐个导出用户数据 ----
echo ""
echo "[2/2] 逐个导出用户数据..."

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS=()

for uid in "${UID_LIST[@]}"; do
  echo ""
  echo "---- 用户 $uid ----"

  USER_CONTAINER="claude-user-$uid"
  USER_OUT="$OUT_DIR/users/$uid"
  mkdir -p "$USER_OUT"

  # 检查用户容器是否存在
  USE_TMP_CONTAINER=false
  NEED_STOP_USER="false"

  if container_exists "$USER_CONTAINER"; then
    NEED_STOP_USER=$(ensure_running "$USER_CONTAINER")
    if [ "$NEED_STOP_USER" = "true" ]; then
      STOPPED_CONTAINERS+=("$USER_CONTAINER")
    fi
  else
    echo "  用户容器 '$USER_CONTAINER' 不存在，尝试从 volume 提取..."
    USE_TMP_CONTAINER=true
  fi

  # 2a: 打包 workspace
  if [ "$USE_TMP_CONTAINER" = "true" ]; then
    USER_VOL=""
    for vol_candidate in \
      "claude-user-$uid-workspace" \
      "claude-user-data-$uid" \
      "claude-code-user-$uid"; do
      if docker volume inspect "$vol_candidate" &>/dev/null; then
        USER_VOL="$vol_candidate"
        break
      fi
    done
    if [ -z "$USER_VOL" ]; then
      echo "  ✗ 跳过：找不到用户 $uid 的数据 volume" >&2
      RESULTS+=("用户$uid:跳折(volume不存在)")
      SKIP_COUNT=$((SKIP_COUNT + 1))
      continue
    fi
    if ! extract_from_volume "$USER_VOL" "$USER_OUT/workspace.tar.gz"; then
      echo "  ✗ 失败：volume 提取出错" >&2
      RESULTS+=("用户$uid:失败(volume提取错误)")
      FAIL_COUNT=$((FAIL_COUNT + 1))
      continue
    fi
  else
    if ! docker exec "$USER_CONTAINER" tar czf - -C /workspace \
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
      > "$USER_OUT/workspace.tar.gz"; then
      echo "  ✗ 失败：打包出错" >&2
      RESULTS+=("用户$uid:失败(打包错误)")
      FAIL_COUNT=$((FAIL_COUNT + 1))
      continue
    fi
  fi

  TAR_SIZE=$(du -sh "$USER_OUT/workspace.tar.gz" | cut -f1)
  echo "  打包完成: workspace.tar.gz ($TAR_SIZE)"

  # 2b: 记录元数据
  # 尝试采集项目列表（容器存在时）
  PROJECTS=""
  if ! $USE_TMP_CONTAINER; then
    PROJECTS=$(docker exec "$USER_CONTAINER" sh -c \
      'ls -1d /workspace/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^\." | sort' 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)
  fi

  # 构建项目列表 JSON（空时为 []，非空时为 ["a","b"]）
  if [ -z "$PROJECTS" ]; then
    PROJECTS_JSON="[]"
  else
    PROJECTS_JSON="[\"${PROJECTS//,/\",\"}\"]"
  fi

  cat > "$USER_OUT/meta.json" <<EOF
{
  "old_user_id": $uid,
  "exported_from": "$USER_CONTAINER",
  "app_container": "$SRC_APP_CONTAINER",
  "export_time": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "projects": $PROJECTS_JSON,
  "db_path": "${DB_PATH:-unknown}"
}
EOF

  echo "  ✓ 用户 $uid 导出完成"
  RESULTS+=("用户$uid:成功")
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
done

# ---- 步骤 3：生成批量 manifest.json ----
echo ""
echo "生成批量 manifest.json..."

# 构建 JSON 数组形式的用户列表
MANIFEST_USERS="["
first=true
for uid in "${UID_LIST[@]}"; do
  META="$OUT_DIR/users/$uid/meta.json"
  if [ -f "$META" ]; then
    if [ "$first" = true ]; then
      first=false
    else
      MANIFEST_USERS+=","
    fi
    MANIFEST_USERS+="
    {\"old_user_id\": $uid}"
  fi
done
MANIFEST_USERS+="
  ]"

cat > "$OUT_DIR/manifest.json" <<EOF
{
  "type": "batch-export",
  "export_time": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "app_container": "$SRC_APP_CONTAINER",
  "db_path": "${DB_PATH:-unknown}",
  "user_count": ${#UID_LIST[@]},
  "users": ${MANIFEST_USERS}
}
EOF

# ---- 汇总 ----
echo ""
echo "============================================"
echo "  批量导出完成！"
echo "============================================"
echo ""
echo "结果汇总："
echo "  成功: $SUCCESS_COUNT"
echo "  跳过: $SKIP_COUNT"
echo "  失败: $FAIL_COUNT"
echo ""
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "产出文件："
ls -lh "$OUT_DIR/"
echo ""
echo "下一步："
echo "  1. 将 $OUT_DIR 整个目录传输到 Linux 服务器："
echo "     scp -r $OUT_DIR user@linux-server:/tmp/"
echo ""
echo "  2. 在 Linux 上运行批量导入："
echo "     sudo ./batch-import-to-linux.sh -i /tmp/batch-export"
