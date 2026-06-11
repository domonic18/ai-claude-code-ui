#!/usr/bin/env bash
# ============================================================================
# batch-import-to-linux.sh — 在 Linux 上批量导入用户数据（清空重导模式）
#
# 流程：
#   1. 停 app 容器
#   2. 备份 DB + 记录已有 volumes
#   3. 清空所有用户数据（DB 用户表 + 所有 claude-user-* volumes）
#   4. 逐个导入用户（ID 从 2 开始顺序分配）
#   5. 任一失败 → 全量回滚（恢复 DB + 删新建 volumes）
#   6. 全部成功 → 重启 app → 打印汇总
#
# 前置条件：
#   - Linux 服务器已部署 Claude Code UI（docker-compose 运行中）
#   - 批量迁移包已 scp 到本机（manifest.json + claude-code.db + users/*/）
#   - sqlite3 命令可用
#   - root 权限
#
# 用法：
#   sudo ./batch-import-to-linux.sh -i /tmp/batch-export
#   sudo ./batch-import-to-linux.sh -i /tmp/batch-export --dry-run
#   sudo ./batch-import-to-linux.sh -i /tmp/batch-export -s 2    # 新 ID 从 2 开始
# ============================================================================

set -euo pipefail

# ============================================================================
# 辅助函数
# ============================================================================

# 从 generated_docs/ 扫描文件，生成 .ai-documents.json manifest
# 参数: $1 = 项目目录的临时路径
build_ai_manifest() {
  local proj_dir="$1"
  local manifest_file="$proj_dir/documents/.ai-documents.json"
  local proj_name
  proj_name=$(basename "$proj_dir")

  mkdir -p "$proj_dir/documents"

  local file_count
  file_count=$(find "$proj_dir/generated_docs" -type f 2>/dev/null | wc -l)
  if [ "$file_count" -eq 0 ]; then
    echo "[]" > "$manifest_file"
    return
  fi

  local first=true
  printf '[' > "$manifest_file"

  while IFS= read -r -d '' fpath; do
    local fname
    fname=$(basename "$fpath")
    local mtime
    mtime=$(stat -c '%Y' "$fpath" 2>/dev/null || echo '0')
    local ts
    ts=$(date -u -d "@$mtime" '+%Y-%m-%dT%H:%M:%S.000Z' 2>/dev/null || echo '1970-01-01T00:00:00.000Z')

    local rel_path
    rel_path=$(realpath --relative-to="$proj_dir/generated_docs" "$fpath" 2>/dev/null \
      || { echo "ERROR: realpath failed for $fpath" >&2; continue; })
    local container_path="/workspace/${proj_name}/generated_docs/${rel_path}"

    local safe_name safe_path
    safe_name=$(printf '%s' "$fname" | sed 's/\\/\\\\/g; s/"/\\"/g')
    safe_path=$(printf '%s' "$container_path" | sed 's/\\/\\\\/g; s/"/\\"/g')

    if [ "$first" = true ]; then
      first=false
    else
      printf ',' >> "$manifest_file"
    fi

    printf '\n  {"file_path":"%s","file_name":"%s","conversation_id":null,"message_id":null,"created_at":"%s"}' \
      "$safe_path" "$safe_name" "$ts" >> "$manifest_file"
  done < <(find "$proj_dir/generated_docs" -type f -print0 2>/dev/null)

  printf '\n]\n' >> "$manifest_file"
}

# 格式化文件大小
format_file_size() {
  local bytes="${1:-0}"
  if [ "$bytes" -eq 0 ]; then echo "未知"
  elif [ "$bytes" -lt 1024 ]; then echo "${bytes}B"
  elif [ "$bytes" -lt 1048576 ]; then
    local kb=$((bytes / 1024)).$(( (bytes % 1024) * 10 / 1024 ))
    echo "${kb}KB"
  else
    local mb=$((bytes / 1048576)).$(( (bytes % 1048576) * 10 / 1048576 ))
    echo "${mb}MB"
  fi
}

# 格式化单条 readme.md 条目
format_readme_entry() {
  local fpath="$1"
  local fname
  fname=$(basename "$fpath")
  local fsize
  fsize=$(stat -c '%s' "$fpath" 2>/dev/null || echo '0')
  local size_str
  size_str=$(format_file_size "$fsize")
  local mtime
  mtime=$(stat -c '%Y' "$fpath" 2>/dev/null || echo '0')
  local date_str
  date_str=$(date -u -d "@$mtime" '+%Y-%m-%d' 2>/dev/null || echo '1970-01-01')

  printf '\n## %s\n- 大小: %s\n- 上传时间: %s\n- 摘要: 请手动增加摘要' "$fname" "$size_str" "$date_str"
}

# 为项目生成 readme.md 默认摘要索引
build_readme_index() {
  local proj_dir="$1"
  local readme_file="$proj_dir/readme.md"

  local entries=""
  local count=0

  if [ -d "$proj_dir/documents/uploads" ]; then
    while IFS= read -r -d '' fpath; do
      entries+=$(format_readme_entry "$fpath")
      count=$((count + 1))
    done < <(find "$proj_dir/documents/uploads" -type f -print0 2>/dev/null)
  fi

  if [ -d "$proj_dir/generated_docs" ]; then
    while IFS= read -r -d '' fpath; do
      entries+=$(format_readme_entry "$fpath")
      count=$((count + 1))
    done < <(find "$proj_dir/generated_docs" -type f -print0 2>/dev/null)
  fi

  if [ "$count" -eq 0 ]; then
    return
  fi

  printf '# 项目文档索引\n%s\n' "$entries" > "$readme_file"
  echo "    生成: readme.md 摘要索引 ($count 个文件)"
}

# 从旧 claude-code.db 注入用户数据到新 claude-code.db
# 参数: $1=new_db  $2=old_db  $3=old_id  $4=new_id
inject_user_data() {
  local new_db="$1" old_db="$2" old_id="$3" new_id="$4"

  if ! [[ "$old_id" =~ ^[0-9]+$ ]] || ! [[ "$new_id" =~ ^[0-9]+$ ]]; then
    echo "  错误：user_id 必须为纯数字（old=$old_id, new=$new_id）" >&2
    return 1
  fi

  local old_username
  old_username=$(sqlite3 "$old_db" "SELECT username FROM users WHERE id=$old_id" 2>/dev/null || true)
  if [ -z "$old_username" ]; then
    echo "  错误：旧库中 user_id=$old_id 不存在" >&2
    return 1
  fi
  echo "  迁移用户: $old_username (旧 id=$old_id → 新 id=$new_id)"

  local safe_username
  safe_username="${old_username//\'/\'\'}"

  # 检查新库是否已有同名用户（清空模式下不应有，但防御性检查）
  local conflict
  conflict=$(sqlite3 "$new_db" "SELECT id FROM users WHERE username='${safe_username}'" 2>/dev/null || true)
  if [ -n "$conflict" ]; then
    echo "  错误：新库已存在用户名 '$old_username' (id=$conflict)！清空步骤可能未生效。" >&2
    return 1
  fi

  local safe_old_db="${old_db//\'/\'\'}"

  sqlite3 "$new_db" <<SQL
ATTACH '${safe_old_db}' AS olddb;
BEGIN;

INSERT INTO users (id, username, password_hash, role, created_at, last_login,
  is_active, git_name, git_email, has_completed_onboarding,
  identity_provider, external_id, sso_enabled)
SELECT ${new_id}, username, password_hash, role, created_at, last_login,
  is_active, git_name, git_email, has_completed_onboarding,
  identity_provider, external_id, sso_enabled
FROM olddb.users WHERE id=${old_id};

INSERT OR IGNORE INTO api_keys (user_id, key_name, api_key, created_at, last_used, is_active)
SELECT ${new_id}, key_name, api_key, created_at, last_used, is_active
FROM olddb.api_keys WHERE user_id=${old_id};

INSERT OR IGNORE INTO user_credentials (user_id, credential_name, credential_type, credential_value, description, created_at, is_active)
SELECT ${new_id}, credential_name, credential_type, credential_value, description, created_at, is_active
FROM olddb.user_credentials WHERE user_id=${old_id};

INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions, created_at, updated_at)
SELECT ${new_id}, provider, allowed_tools, disallowed_tools, skip_permissions, created_at, updated_at
FROM olddb.user_settings WHERE user_id=${old_id};

INSERT OR IGNORE INTO user_mcp_servers (user_id, name, type, config, enabled, created_at, updated_at)
SELECT ${new_id}, name, type, config, enabled, created_at, updated_at
FROM olddb.user_mcp_servers WHERE user_id=${old_id};

COMMIT;
DETACH olddb;
SQL

  # 动态检测并迁移 github_tokens
  local has_gt
  has_gt=$(sqlite3 "$old_db" "SELECT name FROM sqlite_master WHERE type='table' AND name='github_tokens'" 2>/dev/null || true)
  if [ -n "$has_gt" ]; then
    local new_has_gt
    new_has_gt=$(sqlite3 "$new_db" "SELECT name FROM sqlite_master WHERE type='table' AND name='github_tokens'" 2>/dev/null || true)
    if [ -n "$new_has_gt" ]; then
      echo "  迁移 github_tokens..."
      local safe_old_db2="${old_db//\'/\'\'}"
      sqlite3 "$new_db" <<GTSQL
ATTACH '${safe_old_db2}' AS olddb;
INSERT OR IGNORE INTO github_tokens (user_id, token)
SELECT ${new_id}, token FROM olddb.github_tokens WHERE user_id=${old_id};
DETACH olddb;
GTSQL
    fi
  fi

  echo "  账号注入 SQL 执行完成"
}

# ============================================================================
# 回滚函数 — 恢复 DB + 删除新建的 volumes + 重启 app
# 参数: $1=备份DB路径  $2=目标DB路径  $3=新建volumes数组(nameref)  $4=app容器名
# ============================================================================
perform_rollback() {
  local backup_db="$1"
  local target_db="$2"
  local -n _created_vols="$3"
  local app_container="$4"

  echo ""
  echo "============================================"
  echo "  ⚠ 回滚中..."
  echo "============================================"

  # 1. 恢复数据库
  if [ -f "$backup_db" ]; then
    cp "$backup_db" "$target_db"
    echo "  ✓ 数据库已恢复: $target_db"
  else
    echo "  ✗ 备份文件不存在: $backup_db" >&2
  fi

  # 2. 删除所有新建的 sandbox volumes
  for vol in "${_created_vols[@]}"; do
    if docker volume inspect "$vol" &>/dev/null; then
      docker volume rm "$vol" 2>/dev/null && echo "  ✓ 已删除 volume: $vol" || echo "  ✗ 删除 volume 失败: $vol" >&2
    fi
  done

  # 3. 重启 app 容器
  if docker ps -a --format '{{.Names}}' | grep -q "^${app_container}$"; then
    docker start "$app_container" 2>/dev/null && echo "  ✓ app 容器已重启" || true
  fi

  echo ""
  echo "  回滚完成。系统已恢复到导入前的状态。"
  echo "============================================"
}

# ============================================================================
# 主流程
# ============================================================================

# ---- 可配置参数 ----
INPUT_DIR=""
DATA_DIR="${DATA_DIR:-/var/lib/claude-code}"
NODE_UID="${NODE_UID:-1000}"
DRY_RUN=false
ID_START=2  # 新 ID 起始值（1 通常保留给 admin）

# ---- 解析命令行参数 ----
while getopts "i:d:s:nh" opt; do
  case "$opt" in
    i) INPUT_DIR="$OPTARG" ;;
    d) DATA_DIR="$OPTARG" ;;
    s) ID_START="$OPTARG" ;;
    n) DRY_RUN=true ;;
    h)
      echo "用法: sudo $0 -i <迁移包目录> [-d data_dir] [-s start_id] [-n]"
      echo "  -i  批量迁移包目录（必填，含 manifest.json + claude-code.db + users/*/）"
      echo "  -d  数据根目录（默认: /var/lib/claude-code）"
      echo "  -s  新用户 ID 起始值（默认: 2）"
      echo "  -n  dry-run 模式（仅预览，不修改任何文件）"
      echo "  -h  显示帮助"
      exit 0
      ;;
    *) exit 1 ;;
  esac
done

if [ -z "$INPUT_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  INPUT_DIR="$SCRIPT_DIR/batch-export"
fi

# 校验 ID_START 为纯数字
if ! [[ "$ID_START" =~ ^[0-9]+$ ]]; then
  echo "错误：-s 参数必须为纯数字，收到: '$ID_START'" >&2
  exit 1
fi

# ---- 自动检测数据存储路径 ----
if [ "$DATA_DIR" = "/var/lib/claude-code" ]; then
  VOL_MOUNT=$(docker inspect claude-code-app --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
  if [ -n "$VOL_MOUNT" ] && [ -d "$VOL_MOUNT" ]; then
    DATA_DIR="$VOL_MOUNT"
    echo "  自动检测: named volume 挂载点 → $DATA_DIR"
  fi
fi

# ---- 前置检查 ----
MANIFEST_FILE="$INPUT_DIR/manifest.json"
OLD_DB="$INPUT_DIR/claude-code.db"
USERS_DIR="$INPUT_DIR/users"

for f in "$MANIFEST_FILE" "$OLD_DB"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少必要文件: $f" >&2
    exit 1
  fi
done

if [ ! -d "$USERS_DIR" ]; then
  echo "错误：缺少用户数据目录: $USERS_DIR" >&2
  exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
  echo "错误：sqlite3 未安装。请先安装：apt install sqlite3" >&2
  exit 1
fi

# 扫描用户目录，提取旧 user_id 列表
UID_LIST=()
for user_dir in "$USERS_DIR"/*/; do
  [ -d "$user_dir" ] || continue
  uid=$(basename "$user_dir")
  if ! [[ "$uid" =~ ^[0-9]+$ ]]; then
    echo "警告：跳过非数字目录: $uid" >&2
    continue
  fi
  # 校验必要文件存在
  if [ ! -f "$user_dir/workspace.tar.gz" ] || [ ! -f "$user_dir/meta.json" ]; then
    echo "警告：跳过用户 $uid（缺少 workspace.tar.gz 或 meta.json）" >&2
    continue
  fi
  UID_LIST+=("$uid")
done

if [ ${#UID_LIST[@]} -eq 0 ]; then
  echo "错误：未找到任何有效的用户数据目录" >&2
  exit 1
fi

# 定位 Linux 上的数据库
DB_PATH="${DATABASE_PATH:-}"
if [ -z "$DB_PATH" ]; then
  DB_PATH=$(docker exec claude-code-app sh -c 'echo "${DATABASE_PATH:-}"' 2>/dev/null | tr -d '\r' || true)
fi
if [ -n "$DB_PATH" ] && [ ! -f "$DB_PATH" ]; then
  VOL_MOUNT=$(docker inspect claude-code-app --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
  if [ -n "$VOL_MOUNT" ]; then
    HOST_DB_PATH="${DB_PATH/#\/workspace\//$VOL_MOUNT/}"
    if [ -f "$HOST_DB_PATH" ]; then
      DB_PATH="$HOST_DB_PATH"
    fi
  fi
fi
if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
  for candidate in \
    "$DATA_DIR/database/claude-code.db" \
    "/var/lib/claude-code/database/claude-code.db"; do
    if [ -f "$candidate" ]; then DB_PATH="$candidate"; break; fi
  done
fi
if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
  echo "错误：无法定位 claude-code.db。请用 DATABASE_PATH 环境变量指定。" >&2
  exit 1
fi

# ---- 打印计划 ----
echo ""
echo "============================================"
echo "  批量数据导入（清空重导模式）"
echo "============================================"
echo "迁移包目录:  $INPUT_DIR"
echo "数据根目录:  $DATA_DIR"
echo "claude-code.db:     $DB_PATH"
echo "旧数据库:    $OLD_DB"
echo "新 ID 起始:  $ID_START"
echo "node UID:    $NODE_UID"
echo "dry-run:     $DRY_RUN"
echo ""
echo "待导入用户 (${#UID_LIST[@]} 个):"
NEXT_ID=$ID_START
for uid in "${UID_LIST[@]}"; do
  META="$USERS_DIR/$uid/meta.json"
  UNAME=$(grep -o '"username": *"[^"]*"' "$META" | head -1 | sed 's/"username": *"//;s/"$//' 2>/dev/null || echo "?")
  echo "  旧 $uid → 新 $NEXT_ID  ($UNAME)"
  NEXT_ID=$((NEXT_ID + 1))
done
echo "============================================"

# ---- dry-run 模式：到此结束 ----
if $DRY_RUN; then
  echo ""
  echo "[dry-run] 预览完成，未修改任何数据。"
  exit 0
fi

# ============================================================================
# 正式开始：原子性操作（失败全量回滚）
# ============================================================================

APP_CONTAINER="claude-code-app"

# 记录已有的 claude-user-* volumes（用于回滚时区分新增 vs 原有）
EXISTING_VOLUMES=()
while IFS= read -r vol; do
  EXISTING_VOLUMES+=("$vol")
done < <(docker volume ls --format '{{.Name}}' | grep '^claude-user-' 2>/dev/null || true)

# 备份 DB
BACKUP_DIR="$INPUT_DIR/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/claude-code.db.bak"
echo ""
echo "  数据库已备份: $BACKUP_DIR/claude-code.db.bak"

# 新建的 volumes（回滚时需要删除）
CREATED_VOLUMES=()

# ---- 步骤 1：停 app 容器 ----
echo ""
echo "[1/7] 停止 app 容器..."
docker stop "$APP_CONTAINER" 2>/dev/null || true
echo "  ✓ $APP_CONTAINER 已停止"

# ---- 步骤 2：清空所有用户数据 ----
echo ""
echo "[2/7] 清空所有用户数据..."

# 2a: 删除 DB 中所有用户相关数据
sqlite3 "$DB_PATH" <<CLEAN_SQL
BEGIN;
DELETE FROM user_containers;
DELETE FROM container_metrics;
DELETE FROM container_states;
DELETE FROM user_mcp_servers;
DELETE FROM user_settings;
DELETE FROM user_credentials;
DELETE FROM api_keys;
DELETE FROM users WHERE id > 1;
COMMIT;
CLEAN_SQL
echo "  ✓ 用户数据已从 DB 清空"

# 2b: 删除所有 claude-user-* volumes
for vol in "${EXISTING_VOLUMES[@]}"; do
  # 先删除关联的容器（如果存在）
  container_name=$(echo "$vol" | sed 's/-workspace$//')
  if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    docker rm -f "$container_name" 2>/dev/null || true
    echo "  ✓ 已删除容器: $container_name"
  fi
  docker volume rm "$vol" 2>/dev/null || true
  echo "  ✓ 已删除 volume: $vol"
done

echo "  ✓ 所有用户数据已清空"

# ---- 步骤 3~6：逐个导入用户 ----
NEXT_ID=$ID_START
SUCCESS_COUNT=0
FAIL_COUNT=0
RESULTS=()

for uid in "${UID_LIST[@]}"; do
  echo ""
  echo "============================================"
  echo "[用户 $uid → 新 ID $NEXT_ID] 开始导入..."
  echo "============================================"

  USER_DIR="$USERS_DIR/$uid"
  TAR_FILE="$USER_DIR/workspace.tar.gz"
  META_FILE="$USER_DIR/meta.json"

  # 预检：旧库中该用户是否存在
  OLD_USERNAME=$(sqlite3 "$OLD_DB" "SELECT username FROM users WHERE id=$uid" 2>/dev/null || true)
  if [ -z "$OLD_USERNAME" ]; then
    echo "  ✗ 旧库中 user_id=$uid 不存在，跳过" >&2
    RESULTS+=("旧$uid→新$NEXT_ID:跳过(旧库无此用户)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    # 注意：跳过不算致命失败，继续下一个，但 ID 仍然递进
    NEXT_ID=$((NEXT_ID + 1))
    continue
  fi

  # 创建临时目录
  TMP=$(mktemp -d)

  # 步骤 3：解压 + 路径转换
  echo "  [3/7] 解压并转换路径..."
  if ! tar xzf "$TAR_FILE" -C "$TMP" 2>/dev/null; then
    echo "  ✗ 解压失败" >&2
    rm -rf "$TMP"
    RESULTS+=("旧$uid($OLD_USERNAME)→新$NEXT_ID:失败(解压错误)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    NEXT_ID=$((NEXT_ID + 1))
    continue
  fi

  PROJECTS=()
  for d in "$TMP"/*/; do
    proj=$(basename "$d")
    [[ "$proj" == .* ]] && continue
    PROJECTS+=("$proj")
  done
  echo "    发现项目: ${PROJECTS[*]}"

  for proj in "${PROJECTS[@]}"; do
    PROJ_DIR="$TMP/$proj"
    [ -d "$PROJ_DIR" ] || continue
    echo "    处理项目: $proj"

    # uploads/ → documents/uploads/
    if [ -d "$PROJ_DIR/uploads" ]; then
      mkdir -p "$PROJ_DIR/documents"
      mv "$PROJ_DIR/uploads" "$PROJ_DIR/documents/uploads"
      echo "      转换: uploads/ → documents/uploads/"
    fi

    # 删除旧版大写 README.md
    rm -f "$PROJ_DIR/README.md"

    # 补建 .ai-documents.json
    if [ -d "$PROJ_DIR/generated_docs" ]; then
      local_count=$(find "$PROJ_DIR/generated_docs" -type f 2>/dev/null | wc -l)
      echo "      生成: .ai-documents.json ($local_count 个 AI 文档)"
      build_ai_manifest "$PROJ_DIR"
    fi

    # 生成 readme.md
    build_readme_index "$PROJ_DIR"
  done

  # 步骤 4：写入 sandbox volume
  echo "  [4/7] 写入 sandbox volume..."
  SANDBOX_VOL="claude-user-$NEXT_ID-workspace"

  if docker volume inspect "$SANDBOX_VOL" &>/dev/null; then
    echo "  ✗ volume '$SANDBOX_VOL' 已存在" >&2
    rm -rf "$TMP"
    RESULTS+=("旧$uid($OLD_USERNAME)→新$NEXT_ID:失败(volume已存在)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    NEXT_ID=$((NEXT_ID + 1))
    continue
  fi

  docker volume create "$SANDBOX_VOL" > /dev/null
  CREATED_VOLUMES+=("$SANDBOX_VOL")

  docker run --rm \
    -v "$SANDBOX_VOL:/workspace" \
    -v "$TMP:/backup:ro" \
    alpine sh -c "cp -a /backup/. /workspace/ && chown -R 1000:1000 /workspace"

  echo "    ✓ 数据已写入 volume: $SANDBOX_VOL"

  # 清理临时目录
  rm -rf "$TMP"

  # 步骤 5：注入账号
  echo "  [5/7] 注入账号..."
  if ! inject_user_data "$DB_PATH" "$OLD_DB" "$uid" "$NEXT_ID"; then
    echo "  ✗ 账号注入失败，触发全量回滚！" >&2
    # 刚创建的 volume 也记录了，回滚会处理
    perform_rollback "$BACKUP_DIR/claude-code.db.bak" "$DB_PATH" CREATED_VOLUMES "$APP_CONTAINER"
    exit 1
  fi

  echo "  ✓ 用户 $uid ($OLD_USERNAME) 导入完成 → 新 ID $NEXT_ID"
  RESULTS+=("旧$uid($OLD_USERNAME)→新$NEXT_ID:成功")
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  NEXT_ID=$((NEXT_ID + 1))
done

# ---- 步骤 6：重启 app 容器 ----
echo ""
echo "[6/7] 重启 app 容器..."
docker start "$APP_CONTAINER" 2>/dev/null || true
echo "  ✓ $APP_CONTAINER 已重启"

# ---- 步骤 7：汇总 ----
echo ""
echo "[7/7] 导入汇总"
echo ""
echo "============================================"
echo "  批量导入完成！"
echo "============================================"
echo ""
echo "成功: $SUCCESS_COUNT / ${#UID_LIST[@]}"
echo "失败/跳过: $FAIL_COUNT"
echo ""
echo "用户映射："
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "验证步骤："
echo "  1. 登录 Web UI 检查用户列表"
echo "  2. 每个用户登录后检查项目列表"
echo "  3. 检查文档面板（uploads + generated_docs）"
echo ""
echo "回滚方法："
echo "  docker stop claude-code-app"
NEXT_ID=$ID_START
for uid in "${UID_LIST[@]}"; do
  echo "  docker rm -f claude-user-$NEXT_ID 2>/dev/null"
  echo "  docker volume rm claude-user-$NEXT_ID-workspace 2>/dev/null"
  NEXT_ID=$((NEXT_ID + 1))
done
echo "  cp $BACKUP_DIR/claude-code.db.bak $DB_PATH"
echo "  docker start claude-code-app"
