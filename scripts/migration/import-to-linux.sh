#!/usr/bin/env bash
# ============================================================================
# import-to-linux.sh — 在 Linux 上导入迁移包
#
# 在 Linux 服务器上执行，读取 export-from-mac.sh 产出的迁移包，
# 做路径转换、user_id 映射、账号注入、权限对齐。
#
# 前置条件：
#   - Linux 服务器已部署 Claude Code UI（docker-compose 运行中）
#   - 迁移包已 scp 到本机（workspace.tar.gz + claude-code.db + meta.json）
#   - sqlite3 命令可用
#   - root 权限（操作 /var/lib/claude-code 和 docker）
#
# 用法：
#   sudo ./import-to-linux.sh -i /tmp/migration-export
#   sudo ./import-to-linux.sh -i /tmp/migration-export --dry-run
# ============================================================================

set -euo pipefail

# ============================================================================
# 辅助函数（必须在调用前定义）
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

    # 用相对路径保留子目录结构（如 generated_docs/subdir/file.md）
    local rel_path
    rel_path=$(realpath --relative-to="$proj_dir/generated_docs" "$fpath" 2>/dev/null \
      || { echo "ERROR: realpath failed for $fpath" >&2; continue; })
    local container_path="/workspace/${proj_name}/generated_docs/${rel_path}"

    # JSON 安全：转义双引号和反斜杠
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

# 格式化文件大小（与 ReadmeService._formatSize 对齐）
# 参数: $1 = 字节数
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

# 格式化单条 readme.md 条目（与 ReadmeService.appendEntry 格式对齐）
# 参数: $1 = 文件完整路径
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
# 扫描 documents/uploads/ 和 generated_docs/ 下所有文件（含嵌套子目录）
# 摘要统一填"请手动增加摘要"，前端显示 summary_status=ready
# 参数: $1 = 项目目录的临时路径
build_readme_index() {
  local proj_dir="$1"
  local readme_file="$proj_dir/readme.md"
  shift

  local entries=""
  local count=0

  # 扫描 documents/uploads/（用户上传的文档）
  if [ -d "$proj_dir/documents/uploads" ]; then
    while IFS= read -r -d '' fpath; do
      entries+=$(format_readme_entry "$fpath")
      count=$((count + 1))
    done < <(find "$proj_dir/documents/uploads" -type f -print0 2>/dev/null)
  fi

  # 扫描 generated_docs/（AI 生成的文档）
  if [ -d "$proj_dir/generated_docs" ]; then
    while IFS= read -r -d '' fpath; do
      entries+=$(format_readme_entry "$fpath")
      count=$((count + 1))
    done < <(find "$proj_dir/generated_docs" -type f -print0 2>/dev/null)
  fi

  if [ "$count" -eq 0 ]; then
    return  # 没有文件，不建 readme.md
  fi

  # 写入 readme.md（格式严格对齐 ReadmeService）
  printf '# 项目文档索引\n%s\n' "$entries" > "$readme_file"
  echo "    生成: readme.md 摘要索引 ($count 个文件，默认摘要: 请手动增加摘要)"
}

# 从旧 claude-code.db 注入用户数据到新 claude-code.db
# 参数: $1=new_db  $2=old_db  $3=old_id  $4=new_id
inject_user_data() {
  local new_db="$1" old_db="$2" old_id="$3" new_id="$4"

  # 校验 old_id 和 new_id 为纯数字（防 SQL 注入）
  if ! [[ "$old_id" =~ ^[0-9]+$ ]] || ! [[ "$new_id" =~ ^[0-9]+$ ]]; then
    echo "  错误：user_id 必须为纯数字（old=$old_id, new=$new_id）" >&2
    return 1
  fi

  local old_username
  old_username=$(sqlite3 "$old_db" "SELECT username FROM users WHERE id=$old_id" 2>/dev/null || true)
  if [ -z "$old_username" ]; then
    echo "  警告：旧库中 user_id=$old_id 不存在，跳过账号注入" >&2
    return
  fi
  echo "  迁移用户: $old_username (旧 id=$old_id → 新 id=$new_id)"

  # 转义用户名中的单引号（防 SQL 注入：O'Brien → O''Brien）
  local safe_username
  safe_username="${old_username//\'/\'\'}"

  # 检查新库是否已有同名用户
  local conflict
  conflict=$(sqlite3 "$new_db" "SELECT id FROM users WHERE username='${safe_username}'" 2>/dev/null || true)
  if [ -n "$conflict" ]; then
    echo "  错误：新库已存在用户名 '$old_username' (id=$conflict)！请先解决冲突。" >&2
    return 1
  fi

  # 主表注入（users + 已知关联表）
  # 转义路径中的单引号（防 SQL 断裂）
  local safe_old_db="${old_db//\'/\'\'}"

  sqlite3 "$new_db" <<SQL
ATTACH '${safe_old_db}' AS olddb;
BEGIN;

-- users：整行迁移，id 改为新值
INSERT INTO users (id, username, password_hash, role, created_at, last_login,
  is_active, git_name, git_email, has_completed_onboarding,
  identity_provider, external_id, sso_enabled)
SELECT ${new_id}, username, password_hash, role, created_at, last_login,
  is_active, git_name, git_email, has_completed_onboarding,
  identity_provider, external_id, sso_enabled
FROM olddb.users WHERE id=${old_id};

-- api_keys（自增 id 不搬，目标自分配）
INSERT OR IGNORE INTO api_keys (user_id, key_name, api_key, created_at, last_used, is_active)
SELECT ${new_id}, key_name, api_key, created_at, last_used, is_active
FROM olddb.api_keys WHERE user_id=${old_id};

-- user_credentials
INSERT OR IGNORE INTO user_credentials (user_id, credential_name, credential_type, credential_value, description, created_at, is_active)
SELECT ${new_id}, credential_name, credential_type, credential_value, description, created_at, is_active
FROM olddb.user_credentials WHERE user_id=${old_id};

-- user_settings
INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions, created_at, updated_at)
SELECT ${new_id}, provider, allowed_tools, disallowed_tools, skip_permissions, created_at, updated_at
FROM olddb.user_settings WHERE user_id=${old_id};

-- user_mcp_servers
INSERT OR IGNORE INTO user_mcp_servers (user_id, name, type, config, enabled, created_at, updated_at)
SELECT ${new_id}, name, type, config, enabled, created_at, updated_at
FROM olddb.user_mcp_servers WHERE user_id=${old_id};

COMMIT;
DETACH olddb;
SQL

  # 动态检测并迁移 github_tokens（如果旧库存在该表）
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
# 主流程
# ============================================================================

# ---- 可配置参数 ----
INPUT_DIR=""
# 默认数据根目录（Docker 部署的应用数据）
DATA_DIR="${DATA_DIR:-/var/lib/claude-code}"
NODE_UID="${NODE_UID:-1000}"
DRY_RUN=false

# ---- 解析命令行参数 ----
while getopts "i:d:nh" opt; do
  case "$opt" in
    i) INPUT_DIR="$OPTARG" ;;
    d) DATA_DIR="$OPTARG" ;;
    n) DRY_RUN=true ;;
    h)
      echo "用法: sudo $0 -i <迁移包目录> [-d data_dir] [-n]"
      echo "  -i  迁移包目录（必填，含 workspace.tar.gz + claude-code.db + meta.json）"
      echo "  -d  数据根目录（默认: /var/lib/claude-code）"
      echo "  -n  dry-run 模式（仅预览，不修改任何文件）"
      echo "  -h  显示帮助"
      exit 0
      ;;
    *) exit 1 ;;
  esac
done

if [ -z "$INPUT_DIR" ]; then
  # 默认使用脚本所在目录下的 ./data
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  INPUT_DIR="$SCRIPT_DIR/data"
fi

# 自动检测数据存储路径
# docker-compose.deploy.yml 使用 named volume (claude-code-data:/workspace)，
# 用户数据在 named volume 的宿主机路径下，而非 bind mount 的 /var/lib/claude-code。
# 如果用户没有显式传 -d，则从 docker inspect 获取 /workspace 挂载点的宿主机路径。
if [ "$DATA_DIR" = "/var/lib/claude-code" ]; then
  VOL_MOUNT=$(docker inspect claude-code-app --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
  if [ -n "$VOL_MOUNT" ] && [ -d "$VOL_MOUNT" ]; then
    DATA_DIR="$VOL_MOUNT"
    echo "  自动检测: named volume 挂载点 → $DATA_DIR"
  fi
fi

# ---- 前置检查 ----
TAR_FILE="$INPUT_DIR/workspace.tar.gz"
OLD_DB="$INPUT_DIR/claude-code.db"
META_FILE="$INPUT_DIR/meta.json"

for f in "$TAR_FILE" "$META_FILE"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少必要文件: $f" >&2; exit 1
  fi
done

if [ ! -f "$OLD_DB" ]; then
  echo "错误：缺少 claude-code.db。请确认旧 mac 导出时成功拷出了数据库。" >&2
  exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
  echo "错误：sqlite3 未安装。请先安装：apt install sqlite3" >&2; exit 1
fi

# 读取元数据中的旧 user_id
OLD_USER_ID=$(grep -o '"old_user_id": *[0-9]*' "$META_FILE" | grep -o '[0-9]*')

# 校验 OLD_USER_ID 非空且为纯数字
if [ -z "$OLD_USER_ID" ] || ! [[ "$OLD_USER_ID" =~ ^[0-9]+$ ]]; then
  echo "错误：meta.json 中的 old_user_id 无效: '${OLD_USER_ID:-<空>}'" >&2; exit 1
fi

# 定位 Linux 上的数据库
DB_PATH="${DATABASE_PATH:-}"
# 1. 从容器内读取 DATABASE_PATH 环境变量
if [ -z "$DB_PATH" ]; then
  DB_PATH=$(docker exec claude-code-app sh -c 'echo "${DATABASE_PATH:-}"' 2>/dev/null | tr -d '\r' || true)
fi
# 2. 容器内路径映射到宿主机路径（named volume → 宿主机挂载点）
if [ -n "$DB_PATH" ] && [ ! -f "$DB_PATH" ]; then
  VOL_MOUNT=$(docker inspect claude-code-app --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
  if [ -n "$VOL_MOUNT" ]; then
    HOST_DB_PATH="${DB_PATH/#\/workspace\//$VOL_MOUNT/}"
    if [ -f "$HOST_DB_PATH" ]; then
      DB_PATH="$HOST_DB_PATH"
    fi
  fi
fi
# 3. 硬编码候选路径兜底
if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
  for candidate in \
    "$DATA_DIR/database/claude-code.db" \
    "/var/lib/claude-code/database/claude-code.db"; do
    if [ -f "$candidate" ]; then DB_PATH="$candidate"; break; fi
  done
fi
if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
  echo "错误：无法定位 claude-code.db。请用 DATABASE_PATH 环境变量指定。" >&2; exit 1
fi

echo "============================================"
echo "  数据导入：迁移包 → Linux"
echo "============================================"
echo "迁移包目录:  $INPUT_DIR"
echo "数据根目录:  $DATA_DIR"
echo "claude-code.db:     $DB_PATH"
echo "旧用户 ID:   $OLD_USER_ID"
echo "node UID:    $NODE_UID"
echo "dry-run:     $DRY_RUN"
echo "============================================"

# ---- 步骤 0：备份 ----
echo ""
echo "[0/6] 备份当前数据..."
BACKUP_DIR="$INPUT_DIR/backup-$(date +%Y%m%d-%H%M%S)"

$DRY_RUN || {
  mkdir -p "$BACKUP_DIR"
  cp "$DB_PATH" "$BACKUP_DIR/claude-code.db.bak"
  echo "  数据库已备份: $BACKUP_DIR/claude-code.db.bak"
}

# ---- 步骤 0.5：提前停 app 容器（避免后续 db 锁 + 先查账号冲突） ----
echo ""
echo "  停止 app 容器（避免 db 锁）..."
$DRY_RUN || docker stop claude-code-app 2>/dev/null || true

# ---- 步骤 1：算新 user_id + 预检账号冲突 ----
echo ""
echo "[1/6] 计算新 user_id + 预检账号冲突..."
NEW_USER_ID=$(sqlite3 "$DB_PATH" "SELECT COALESCE(MAX(id),0)+1 FROM users")
echo "  新 user_id = $NEW_USER_ID"

# 提前检查：旧库用户是否可注入（用户名冲突、用户是否存在）
# 这样可以在写数据之前就发现问题，避免半成品状态
$DRY_RUN || {
  OLD_USERNAME=$(sqlite3 "$OLD_DB" "SELECT username FROM users WHERE id=$OLD_USER_ID" 2>/dev/null || true)
  if [ -z "$OLD_USERNAME" ]; then
    echo "  错误：旧库 claude-code.db 中 user_id=$OLD_USER_ID 不存在！" >&2
    echo "  请检查 meta.json 中的 old_user_id 是否正确。" >&2
    docker start claude-code-app 2>/dev/null || true
    exit 1
  fi
  # 转义单引号
  SAFE_OLD_UNAME="${OLD_USERNAME//\'/\'\'}"
  CONFLICT_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM users WHERE username='${SAFE_OLD_UNAME}'" 2>/dev/null || true)
  if [ -n "$CONFLICT_ID" ]; then
    echo "  错误：新库已存在同名用户 '$OLD_USERNAME' (id=$CONFLICT_ID)！" >&2
    echo "  请先解决冲突后再迁移。" >&2
    docker start claude-code-app 2>/dev/null || true
    exit 1
  fi
  echo "  预检通过：旧用户 '$OLD_USERNAME' 可注入为 id=$NEW_USER_ID"
}

SANDBOX_VOL="claude-user-$NEW_USER_ID-workspace"
if docker volume inspect "$SANDBOX_VOL" &>/dev/null; then
  echo "错误：sandbox volume '$SANDBOX_VOL' 已存在（可能之前的迁移未清理）" >&2
  echo "  清理命令: docker volume rm $SANDBOX_VOL" >&2
  exit 1
fi

# ---- 步骤 2：解压 + 路径转换 ----
echo ""
echo "[2/6] 解压并转换路径..."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

tar xzf "$TAR_FILE" -C "$TMP"

# 发现项目目录（排除 .开头）
PROJECTS=()
for d in "$TMP"/*/; do
  proj=$(basename "$d")
  [[ "$proj" == .* ]] && continue
  PROJECTS+=("$proj")
done
echo "  发现项目: ${PROJECTS[*]}"

for proj in "${PROJECTS[@]}"; do
  PROJ_DIR="$TMP/$proj"
  [ -d "$PROJ_DIR" ] || continue
  echo "  处理项目: $proj"

  # uploads/ → documents/uploads/（保留日期子目录结构）
  if [ -d "$PROJ_DIR/uploads" ]; then
    echo "    转换: uploads/ → documents/uploads/"
    $DRY_RUN || {
      mkdir -p "$PROJ_DIR/documents"
      mv "$PROJ_DIR/uploads" "$PROJ_DIR/documents/uploads"
    }
  fi

  # 删除旧版大写 README.md 模板
  if [ -f "$PROJ_DIR/README.md" ]; then
    echo "    删除: 旧 README.md 模板"
    $DRY_RUN || rm -f "$PROJ_DIR/README.md"
  fi

  # 补建 .ai-documents.json（从 generated_docs/ 扫描）
  if [ -d "$PROJ_DIR/generated_docs" ]; then
    local_count=$(find "$PROJ_DIR/generated_docs" -type f 2>/dev/null | wc -l)
    echo "    生成: documents/.ai-documents.json (${local_count} 个 AI 文档)"
    $DRY_RUN || build_ai_manifest "$PROJ_DIR"
  fi

  # 生成 readme.md 默认摘要索引（uploads + generated_docs，统一摘要: 请手动增加摘要）
  $DRY_RUN || build_readme_index "$PROJ_DIR"
done

# ---- 步骤 3：写入 sandbox volume ----
echo ""
echo "[3/6] 写入 sandbox volume..."

$DRY_RUN || {
  docker volume create "$SANDBOX_VOL" > /dev/null
  docker run --rm     -v "$SANDBOX_VOL:/workspace"     -v "$TMP:/backup:ro"     alpine sh -c "cp -a /backup/. /workspace/ && chown -R 1000:1000 /workspace"
  echo "  数据已写入 volume: $SANDBOX_VOL"
}

# ---- 步骤 4：账号注入 ----
echo ""
echo "[4/6] 注入账号..."

$DRY_RUN && echo "  [dry-run] 将注入 user_id=$NEW_USER_ID" || {
  inject_user_data "$DB_PATH" "$OLD_DB" "$OLD_USER_ID" "$NEW_USER_ID"
}

# ---- 步骤 5：重启 ----
echo ""
echo "[5/6] 重启 app 容器..."
$DRY_RUN || {
  docker start claude-code-app 2>/dev/null || true
  echo "  claude-code-app 已重启"
}

# ---- 步骤 6：摘要 ----
echo ""
echo "[6/6] 完成"
echo ""
echo "============================================"
echo "  导入完成！"
echo "============================================"
echo ""
echo "新用户信息："
echo "  user_id:    $NEW_USER_ID"
echo "  sandbox volume: $SANDBOX_VOL"
echo "  容器名:     claude-user-$NEW_USER_ID（登录时自动创建）"
echo ""
echo "验证步骤："
echo "  1. 用迁过来的账号登录 Web UI"
echo "  2. 检查项目列表（应显示: ${PROJECTS[*]}）"
echo "  3. 进项目检查会话历史"
echo "  4. 检查文档面板（uploads + generated_docs）"
echo "  5. 检查 skills/settings 等配置"
echo ""
echo "回滚方法："
echo "  docker stop claude-user-$NEW_USER_ID 2>/dev/null"
echo "  docker rm claude-user-$NEW_USER_ID 2>/dev/null"
echo "  docker volume rm $SANDBOX_VOL"
echo "  cp $BACKUP_DIR/claude-code.db.bak $DB_PATH"
echo "  docker restart claude-code-app"