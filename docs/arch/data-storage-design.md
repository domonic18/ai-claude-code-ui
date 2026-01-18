# Claude Code UI - 数据存储设计

> **文档版本**: 3.2
> **创建时间**: 2026-01-10
> **最后更新**: 2026-01-18
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、存储架构概览](#一存储架构概览)
- [二、Docker Volume 设计](#二docker-volume-设计)
- [三、数据库设计](#三数据库设计)
- [四、容器数据持久化策略](#四容器数据持久化策略)
- [五、目录结构规范](#五目录结构规范)

---

## 一、存储架构概览

### 1.1 宿主机存储结构

```
宿主机存储结构:
/
└── /path/to/ai-claude-code-ui/                 # 项目根目录
    ├── backend/                                # 后端代码
    ├── frontend/                               # 前端代码
    ├── dist/                                   # 构建产物
    └── workspace/                              # 持久化数据目录（与代码分离）
        ├── database/                           # 全局数据库
        │   └── auth.db                         # 用户认证数据
        ├── users/                              # 用户数据目录
        │   ├── user_1/                         # 用户 1 数据
        │   │   └── data/                       # 挂载到容器的统一目录
        │   │       ├── .claude/                # 用户级 Claude 配置（所有项目共享）
        │   │       │   ├── settings.json       # Claude 设置（hooks、工具开关等）
        │   │       │   ├── CLAUDE.md           # 用户级项目上下文
        │   │       │   ├── commands/           # 自定义斜杠命令
        │   │       │   │   ├── my-command.md
        │   │       │   │   └── ...
        │   │       │   ├── skills/             # Agent Skills（所有项目共享）
        │   │       │   │   └── skill-name/
        │   │       │   │       ├── SKILL.md
        │   │       │   │       ├── schema.json
        │   │       │   │       └── helper.js
        │   │       │   ├── agents/             # Subagent 配置
        │   │       │   │   └── subagent-name.json
        │   │       │   ├── api_keys.json       # API 密钥
        │   │       ├── my-workspace/           # 默认工作区（项目代码）
        │   │       │   ├── .claude/            # 项目级配置（覆盖用户级）
        │   │       │   │   ├── CLAUDE.md       # 项目上下文
        │   │       │   │   ├── settings.local.json
        │   │       │   │   ├── commands/       # 项目级命令
        │   │       │   │   └── skills/         # 项目级 Skills
        │   │       │   ├── src/
        │   │       │   ├── package.json
        │   │       │   └── README.md
        │   │       ├── project-2/              # 其他项目
        │   │       │   └── .claude/            # 项目级配置
        │   │       └── ...
        │   ├── user_2/                         # 用户 2 数据
        │   │   └── data/
        │   └── ...
        ├── containers/                         # 容器配置
        │   ├── seccomp/                        # Seccomp 策略
        │   │   └── claude-code.json           # 默认策略
        │   └── apparmor/                       # AppArmor 配置
        ├── logs/                               # 系统日志
        │   ├── container-manager.log           # 容器管理日志
        │   └── container-*.log                 # 各容器日志
        └── backups/                            # 备份目录
            ├── daily/                          # 每日备份
            ├── weekly/                         # 每周备份
            └── monthly/                        # 每月备份
```

### 1.2 设计原则

1. **数据与代码分离**：将用户数据存储在 `workspace/` 目录下，与代码仓库分离
2. **用户数据隔离**：每个用户拥有独立的数据目录
3. **统一工作目录**：容器内使用 `/workspace` 作为唯一工作目录，简化路径管理
4. **单一挂载点**：通过单一 bind mount 实现数据持久化，避免配置复杂度
5. **定期备份**：自动化备份策略，防止数据丢失
6. **日志分离**：系统日志和用户日志分开存储

---

## 二、Docker Volume 设计

### 2.1 统一工作目录卷

#### 2.1.1 卷配置

```javascript
// 为每个用户创建专属的数据目录
// 使用项目根目录下的 ./workspace 目录
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const createUserVolume = (userId) => {
  const userDataDir = path.join(PROJECT_ROOT, 'workspace', 'users', `user_${userId}`, 'data');

  return {
    // 容器内挂载点
    containerPath: '/workspace',
    // 宿主机源路径
    hostPath: userDataDir,
    // 挂载选项
    options: 'rw'  // 读写
  };
};
```

#### 2.1.2 挂载点映射（统一方案）

| 宿主机路径 | 容器内路径 | 说明 |
|-----------|-----------|------|
| `./workspace/users/user_{id}/data` | `/workspace` | 统一工作目录 |

**容器内目录结构**：
```
/workspace/                              # 统一工作目录（所有操作都在这里）
├── .claude/                             # 用户级 Claude 配置（共享给所有项目）
│   ├── settings.json                    # Claude 设置（包含 hooks、工具开关等）
│   ├── CLAUDE.md                        # 用户级项目上下文和指令
│   ├── commands/                        # 自定义斜杠命令（.md 文件）
│   │   ├── my-command.md
│   │   └── ...
│   ├── skills/                          # Agent Skills（用户级，所有项目共享）
│   │   └── skill-name/
│   │       ├── SKILL.md                 # 必需：技能描述
│   │       └── ...                      # 可选：支持文件/脚本
│   ├── agents/                          # Subagent 配置
│   │   └── agent-name.json
│   └── hooks/                           # 事件钩子（配置在 settings.json 中）
├── my-workspace/                        # 默认工作区（项目代码）
│   ├── .claude/                         # 项目级 Claude 配置（覆盖用户级配置）
│   │   ├── CLAUDE.md                    # 项目上下文
│   │   ├── settings.local.json          # 项目本地设置（覆盖用户级）
│   │   ├── commands/                    # 项目级自定义命令
│   │   │   └── project-command.md
│   │   └── skills/                      # 项目级 Agent Skills
│   │       └── project-skill/
│   │           └── SKILL.md
│   ├── src/
│   ├── package.json
│   └── ...
├── project-2/                           # 其他项目
│   └── ...
└── ...
```

**注意**：全局数据库位于宿主机 `workspace/database/auth.db`，由服务器统一管理，容器内无数据库。

### 2.2 环境变量配置

```javascript
// 容器环境变量
const containerEnv = {
  // 关键：设置 HOME 指向 /workspace
  // 这样 ~/.claude/ = /workspace/.claude/，符合 Claude Code 官方标准
  HOME: '/workspace',

  // 用户标识
  USER_ID: userId,
  USER_TIER: 'free',  // free, pro, enterprise

  // Claude 配置目录（可选，HOME 设置后自动使用 ~/.claude/）
  CLAUDE_CONFIG_DIR: '/workspace/.claude',

  // 节点环境
  NODE_ENV: 'production',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
};
```

**重要说明**：
- `HOME=/workspace` 是核心配置，确保容器内 `~` 指向 `/workspace`
- 这样 `~/.claude/` 自动映射到 `/workspace/.claude/`，符合 Claude Code 官方标准
- 所有项目共享用户级配置（`~/.claude/skills/`、`~/.claude/commands/`）

### 2.3 Claude Code 配置作用域

根据官方文档，Claude Code 支持多个配置作用域，优先级从低到高：

| 作用域 | 位置（宿主机） | 位置（容器内） | 说明 | 示例 |
|--------|---------------|---------------|------|------|
| **Managed** | - | `/etc/claude/` | 系统管理员配置，不可被用户修改 | `/etc/claude/settings.json` |
| **User** | `workspace/users/user_1/data/.claude/` | `~/.claude/` = `/workspace/.claude/` | 用户级配置，所有项目共享 | 用户自定义 skills/commands |
| **Project** | `workspace/users/user_1/data/my-workspace/.claude/` | `/workspace/my-workspace/.claude/` | 项目级配置，覆盖用户级 | 项目特定的 CLAUDE.md |
| **Local** | `workspace/users/user_1/data/my-workspace/.claude/*.local.*` | `/workspace/my-workspace/.claude/*.local.*` | 本地覆盖，不提交到 Git | `settings.local.json` |

**关键说明**：
- 容器内设置 `HOME=/workspace` 后，`~/.claude/` 等同于 `/workspace/.claude/`
- 这符合 Claude Code 官方标准的 `~/.claude/` 用户配置路径
- 所有配置都持久化到宿主机，容器重启后不会丢失

**配置继承规则**：
1. 项目启动时，按优先级合并配置：Managed → User → Project → Local
2. 同一配置项，高优先级覆盖低优先级
3. Skills 和 Commands 支持用户级和项目级，项目级优先

**共享配置实现方案**：

```
# 用户级配置（所有项目共享）
/workspace/.claude/
├── skills/
│   └── common-task/           # 通用技能（所有项目可用）
│       └── SKILL.md
├── commands/
│   └── analyze.md             # 自定义命令（所有项目可用）
└── settings.json              # 用户偏好设置

# 项目级配置（项目特定，覆盖用户级）
/workspace/my-workspace/.claude/
├── CLAUDE.md                  # 项目上下文（仅此项目）
├── skills/
│   └── project-specific/      # 项目专用技能
│       └── SKILL.md
└── settings.local.json        # 项目本地设置（不提交）
```

**API 密钥存储位置**：
根据官方文档，API 密钥应存储在用户级配置目录：
```bash
/workspace/.claude/api_keys.json  # 用户级密钥（所有项目共享）
```

### 2.4 会话历史存储机制

**重要说明**：官方 Claude Code 文档中**未明确说明**会话历史的具体存储位置。官方文档提到：
- `.claude/` 目录用于配置、skills、commands、agents
- 会话历史由 SDK 内部管理，但具体位置未在文档中说明

**当前实现的会话存储**：
根据项目现有代码分析，会话历史可能存储在以下位置（需进一步验证）：
```bash
# 主机模式（非容器）
~/.claude/sessions/              # 会话历史（可能位置）
~/.claude/projects/              # 项目元数据（当前代码使用）

# 容器模式
/workspace/.claude/sessions/      # 容器内会话历史
/workspace/.claude/projects/      # 项目元数据（需评估是否为官方标准）
```

**UI 显示会话历史的实现方案**：

1. **通过 SDK API 读取**（推荐）：
   ```javascript
   // 使用 Claude SDK 的会话历史 API
   const sessions = await claudeSDK.getSessionHistory(projectPath);
   ```

2. **从项目元数据读取**（当前实现）：
   ```javascript
   // 从 .claude/projects/{projectName}/ 读取会话记录
   const sessions = await getSessions(projectName);
   ```

3. **会话索引文件**：
   ```json
   // /workspace/.claude/sessions/index.json
   {
     "sessionId": "uuid",
     "projectPath": "/workspace/my-workspace",
     "createdAt": "2026-01-12T00:00:00Z",
     "lastAccessed": "2026-01-12T01:00:00Z"
   }
   ```

### 2.5 卷管理策略

#### 创建策略
- 用户注册时自动创建专属数据目录
- 使用 bind mount 模式，数据直接存储在宿主机
- 避免使用 Docker 管理的 Volume，便于备份和恢复

#### 删除策略
- 用户删除账户时，可选择删除或保留数据目录
- 容器销毁时不自动删除数据目录，保护用户数据
- 提供手动清理工具，定期清理孤儿数据

---

## 三、数据库设计

### 3.1 用户表扩展

在现有 `users` 表基础上添加容器相关字段：

```sql
-- 新增字段到 users 表
ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN container_config TEXT;
ALTER TABLE users ADD COLUMN resource_quota TEXT;
```

### 3.2 容器状态表

```sql
-- 容器状态表
CREATE TABLE IF NOT EXISTS user_containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  container_id TEXT NOT NULL UNIQUE,
  container_name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  resource_usage TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**字段说明**：
- `user_id`: 关联的用户 ID
- `container_id`: Docker 容器 ID (64 位十六进制)
- `container_name`: 容器名称 (如 `claude-user-1`)
- `status`: 容器状态 (`running`, `stopped`, `paused`)
- `created_at`: 容器创建时间
- `last_active`: 最后活跃时间（用于清理空闲容器）
- `resource_usage`: JSON 字符串，存储资源使用情况

### 3.3 容器资源使用记录表

```sql
-- 容器资源使用记录表
CREATE TABLE IF NOT EXISTS container_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,
  cpu_percent REAL,
  memory_used INTEGER,
  memory_limit INTEGER,
  disk_used INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (container_id) REFERENCES user_containers(container_id)
);
```

**字段说明**：
- `container_id`: 关联的容器 ID
- `cpu_percent`: CPU 使用百分比
- `memory_used`: 已使用内存（字节）
- `memory_limit`: 内存限制（字节）
- `disk_used`: 磁盘使用量（字节）
- `recorded_at`: 记录时间

### 3.4 数据模型示例

```javascript
// 用户容器配置模型
const UserContainerConfig = {
  userId: 1,
  tier: 'pro',  // free, pro, enterprise
  containerId: 'claude-user-1-container',
  dataDir: '/workspace',
  resourceLimits: {
    cpu: '2',
    memory: '4G',
    disk: '20G',
    timeout: 3600
  },
  securityOptions: [
    'apparmor=docker-default',
    'seccomp=claude-code.json'
  ]
};
```

### 3.5 索引优化

```sql
-- 为常用查询添加索引
CREATE INDEX idx_user_containers_user_id ON user_containers(user_id);
CREATE INDEX idx_user_containers_status ON user_containers(status);
CREATE INDEX idx_user_containers_last_active ON user_containers(last_active);
CREATE INDEX idx_container_metrics_container_id ON container_metrics(container_id);
CREATE INDEX idx_container_metrics_recorded_at ON container_metrics(recorded_at);
```

---

## 四、容器数据持久化策略

### 4.1 数据分类处理

| 数据类型 | 存储位置 | 持久化策略 | 备份策略 | 说明 |
|---------|---------|-----------|---------|------|
| 用户代码 | `/workspace/my-workspace/` | Docker Volume (bind mount) | 每日备份 | 项目实际代码 |
| 用户级配置 | `/workspace/.claude/` | Docker Volume (bind mount) | 每日备份 | 共享给所有项目 |
| 用户级 Skills | `/workspace/.claude/skills/` | Docker Volume (bind mount) | 每日备份 | 所有项目共享 |
| 用户级 Commands | `/workspace/.claude/commands/` | Docker Volume (bind mount) | 每日备份 | 所有项目共享 |
| 项目级配置 | `/workspace/my-workspace/.claude/` | Docker Volume (bind mount) | 每日备份 | 项目特定，覆盖用户级 |
| API 密钥 | `/workspace/.claude/api_keys.json` | Docker Volume (bind mount) | 每日备份 | 用户级密钥 |
| 会话历史 | `/workspace/.claude/sessions/` | Docker Volume (bind mount) | 每日备份 | SDK 管理 |
| 临时文件 | 容器内 `/tmp` | 容器销毁时删除 | 不备份 | 临时数据 |
| 构建产物 | `/workspace/my-workspace/node_modules/` | Docker Volume (bind mount) | 按需备份 | 可重建 |

### 4.2 备份策略

#### 4.2.1 自动备份配置

```javascript
// 自动备份策略（数据目录与代码分离）
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const backupStrategy = {
  schedule: 'daily',  // 每日备份
  retention: {
    daily: 7,      // 保留 7 天
    weekly: 4,     // 保留 4 周
    monthly: 3     // 保留 3 个月
  },
  compression: 'gzip',
  sourceDir: path.join(PROJECT_ROOT, 'workspace', 'users'),
  destination: path.join(PROJECT_ROOT, 'workspace', 'backups')
};
```

#### 4.2.2 备份脚本示例

```bash
#!/bin/bash
# backup.sh - 用户数据备份脚本

PROJECT_ROOT="/path/to/ai-claude-code-ui"
WORKSPACE_DIR="${PROJECT_ROOT}/workspace"
BACKUP_DIR="${WORKSPACE_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/weekly"
mkdir -p "${BACKUP_DIR}/monthly"

# 备份用户数据
for user_dir in ${WORKSPACE_DIR}/users/*/; do
  user_name=$(basename "$user_dir")
  backup_file="${BACKUP_DIR}/daily/${user_name}_${DATE}.tar.gz"

  tar -czf "$backup_file" -C "$user_dir/data" .

  # 验证备份
  if [ $? -eq 0 ]; then
    echo "Backup successful: $backup_file"
  else
    echo "Backup failed: $user_name"
  fi
done

# 备份数据库
cp "${WORKSPACE_DIR}/database/auth.db" "${BACKUP_DIR}/daily/db_${DATE}.db"

# 清理过期备份
find "${BACKUP_DIR}/daily" -name "*.tar.gz" -mtime +7 -delete
find "${BACKUP_DIR}/daily" -name "*.db" -mtime +7 -delete
find "${BACKUP_DIR}/weekly" -name "*.tar.gz" -mtime +30 -delete
find "${BACKUP_DIR}/monthly" -name "*.tar.gz" -mtime +90 -delete
```

### 4.3 数据恢复流程

```bash
#!/bin/bash
# restore.sh - 用户数据恢复脚本

BACKUP_FILE=$1  # 备份文件路径
USER_ID=$2      # 用户 ID
PROJECT_ROOT="/path/to/ai-claude-code-ui"

if [ -z "$BACKUP_FILE" ] || [ -z "$USER_ID" ]; then
  echo "Usage: ./restore.sh <backup_file> <user_id>"
  exit 1
fi

USER_DIR="${PROJECT_ROOT}/workspace/users/user_${USER_ID}/data"

# 停止用户容器
docker stop "claude-user-${USER_ID}" 2>/dev/null || true

# 恢复数据
mkdir -p "$USER_DIR"
tar -xzf "$BACKUP_FILE" -C "$USER_DIR"

# 重启容器
docker start "claude-user-${USER_ID}" 2>/dev/null || echo "Container will be created on next login"

echo "Restore completed for user ${USER_ID}"
```

### 4.4 存储容量管理

#### 4.4.1 容量监控

```javascript
// 存储容量监控脚本
import fs from 'fs';
import path from 'path';

function checkStorageUsage() {
  const workspaceDir = path.join(PROJECT_ROOT, 'workspace', 'users');

  function getDirSize(dirPath) {
    let size = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stats.size;
      }
    }

    return size;
  }

  // 检查每个用户的存储使用
  const userDirs = fs.readdirSync(workspaceDir);

  for (const userDir of userDirs) {
    const userPath = path.join(workspaceDir, userDir, 'data');
    const size = getDirSize(userPath);
    const sizeGB = (size / (1024 ** 3)).toFixed(2);

    console.log(`${userDir}: ${sizeGB} GB`);

    // 警告阈值
    if (size > 20 * (1024 ** 3)) {
      console.warn(`⚠️  ${userDir} exceeds 20 GB quota`);
    }
  }
}
```

#### 4.4.2 配额限制

```javascript
// 用户存储配额配置
const storageQuotas = {
  free: {
    maxDisk: 10 * 1024 ** 3,    // 10 GB
    maxContainers: 1
  },
  pro: {
    maxDisk: 50 * 1024 ** 3,    // 50 GB
    maxContainers: 3
  },
  enterprise: {
    maxDisk: 200 * 1024 ** 3,   // 200 GB
    maxContainers: 10
  }
};
```

---

## 五、目录结构规范

### 5.1 宿主机目录规范

```
/workspace/                              # 宿主机项目根目录
├── database/
│   └── auth.db                        # 全局认证数据库
├── users/
│   ├── user_1/
│   │   └── data/                      # 持久化到容器 /workspace
│   │       ├── .claude/               # 用户级 Claude 配置（所有项目共享）
│   │       │   ├── settings.json      # Claude 设置（hooks、工具开关等）
│   │       │   ├── CLAUDE.md          # 用户级项目上下文
│   │       │   ├── commands/          # 自定义斜杠命令
│   │       │   │   ├── my-command.md
│   │       │   │   └── ...
│   │       │   ├── skills/            # Agent Skills（所有项目共享）
│   │       │   │   └── skill-name/
│   │       │   │       ├── SKILL.md
│   │       │   │       ├── schema.json
│   │       │   │       └── helper.js
│   │       │   ├── agents/            # Subagent 配置
│   │       │   │   └── subagent-name.json
│   │       │   ├── api_keys.json      # API 密钥
│   │       │   └── sessions/          # 会话历史（SDK 管理）
│   │       │       └── {session-id}/
│   │       │           ├── metadata.json
│   │       │           └── messages.jsonl
│   │       ├── my-workspace/          # 默认工作区（项目代码）
│   │       │   ├── .claude/           # 项目级配置（覆盖用户级）
│   │       │   │   ├── CLAUDE.md      # 项目上下文
│   │       │   │   ├── settings.local.json
│   │       │   │   ├── commands/      # 项目级命令
│   │       │   │   └── skills/        # 项目级 Skills
│   │       │   ├── src/
│   │       │   ├── package.json
│   │       │   └── README.md
│   │       ├── project-2/             # 其他项目
│   │       │   └── .claude/           # 项目级配置
│   │       └── ...
│   ├── user_2/
│   │   └── data/
│   └── ...
├── containers/
│   └── seccomp/
│       └── claude-code.json           # Seccomp 安全策略
├── logs/
│   ├── container-manager.log
│   └── container-*.log
└── backups/
    ├── daily/
    ├── weekly/
    └── monthly/
```

**宿主机与容器内路径对应关系**：

| 宿主机路径 | 容器内路径 | 容器内简写 | 说明 |
|-----------|-----------|-----------|------|
| `workspace/users/user_1/data` | `/workspace` | `~` | 通过 HOME=/workspace |
| `workspace/users/user_1/data/.claude/` | `/workspace/.claude/` | `~/.claude/` | **用户级配置，符合官方标准** |
| `workspace/users/user_1/data/.claude/skills/` | `/workspace/.claude/skills/` | `~/.claude/skills/` | 所有项目共享 |
| `workspace/users/user_1/data/my-workspace/` | `/workspace/my-workspace/` | - | 项目代码 |
| `workspace/users/user_1/data/my-workspace/.claude/` | `/workspace/my-workspace/.claude/` | - | **项目级配置** |

### 5.2 容器内目录规范（基于官方文档）

```
/workspace/                              # 统一工作目录
├── .claude/                             # 用户级 Claude 配置（所有项目共享）
│   ├── settings.json                    # Claude 设置（hooks、工具开关等）
│   │   {
│   │     "editor": "vim",
│   │     "autoConfirm": "dangerous",
│   │     "hooks": {
│   │       "preCommand": "",
│   │       "postCommand": ""
│   │     }
│   │   }
│   ├── CLAUDE.md                        # 用户级项目上下文和指令
│   ├── commands/                        # 自定义斜杠命令（.md 文件）
│   │   ├── analyze.md                   # 命令定义
│   │   └── review.md
│   ├── skills/                          # Agent Skills（用户级，所有项目共享）
│   │   └── code-review/                 # Skill 名称
│   │       ├── SKILL.md                 # 必需：技能描述
│   │       ├── schema.json              # 可选：参数结构
│   │       └── helper.js                # 可选：辅助脚本
│   ├── agents/                          # Subagent 配置
│   │   └── subagent-name.json
│   ├── api_keys.json                    # API 密钥存储
│   │   {
│   │     "providers": [
│   │       {
│   │         "name": "Anthropic",
│   │         "provider": "anthropic",
│   │         "apiKey": "sk-ant-..."
│   │       }
│   │     ]
│   │   }
│   └── sessions/                        # 会话历史（SDK 管理）
│       └── {session-id}/
│           ├── metadata.json
│           └── messages.jsonl
├── my-workspace/                        # 默认工作区（项目代码）
│   ├── .claude/                         # 项目级配置（覆盖用户级）
│   │   ├── CLAUDE.md                    # 项目上下文
│   │   ├── settings.local.json          # 项目本地设置（不提交 Git）
│   │   ├── commands/                    # 项目级自定义命令
│   │   │   └── build.md
│   │   └── skills/                      # 项目级 Agent Skills
│   │       └── project-specific/
│   │           └── SKILL.md
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── README.md
├── project-2/                           # 其他项目
│   └── .claude/                         # 项目级配置
│       └── CLAUDE.md
└── temp/                                # 临时文件（可选）
```

### 5.3 路径显示映射规范

**问题**：当前 UI 显示 `workspace/users/user_1/data/my-workspace` 而不是 `/workspace/my-workspace`

**解决方案**：在项目数据返回给前端之前，统一进行路径转换

| 宿主机路径 | 容器内路径 | UI 显示路径 | 说明 |
|-----------|-----------|-----------|------|
| `workspace/users/user_1/data/my-workspace` | `/workspace/my-workspace` | `/workspace/my-workspace` | 用户项目 |
| `workspace/users/user_1/data/.claude` | `/workspace/.claude` | 不显示 | 系统目录，过滤掉 |
| `workspace/users/user_1/data/project-2` | `/workspace/project-2` | `/workspace/project-2` | 其他项目 |

**代码实现建议**：

```javascript
// backend/services/container/file/project-manager.js
export async function getProjectsInContainer(userId) {
  // ... 列出项目的代码 ...

  const projectList = [];

  for (const projectName of projectNames) {
    // 转换路径：只返回容器内路径，不返回宿主机路径
    projectList.push({
      name: projectName,
      path: projectName,                    // 简短路径
      displayName: projectName,
      fullPath: `/workspace/${projectName}`, // 容器内完整路径
      isContainerProject: true,
      // 不返回 hostPath
    });
  }

  return projectList;
}
```

### 5.4 路径使用规范

| 用途 | 路径示例 | 说明 |
|------|---------|------|
| 项目根目录 | `/workspace/project-1` | 项目代码根目录 |
| Claude 配置 | `/workspace/.claude` | Claude CLI 配置目录 |
| 项目元数据 | `/workspace/.claude/projects` | 项目列表和配置 |
| 工作命令执行 | `cwd: /workspace/project-1` | 在项目目录执行命令 |
| 文件读取 | `/workspace/project-1/src/main.js` | 读取项目文件 |
| 文件写入 | `/workspace/project-1/new-file.js` | 写入项目文件 |

### 5.5 API 密钥存储格式

```json
// /workspace/.claude/api_keys.json
{
  "providers": [
    {
      "name": "Anthropic",
      "provider": "anthropic",
      "apiKey": "sk-ant-...",
      "baseURL": "https://api.anthropic.com"
    },
    {
      "name": "OpenAI",
      "provider": "openai",
      "apiKey": "sk-...",
      "baseURL": "https://api.openai.com/v1"
    },
    {
      "name": "智谱 GLM",
      "provider": "custom",
      "apiKey": "...",
      "baseURL": "https://open.bigmodel.cn/api/anthropic"
    }
  ]
}
```

### 5.6 Claude 设置文件格式

```json
// /workspace/.claude/settings.json
{
  "editor": "vim",
  "autoConfirm": "dangerous",
  "dangerouslyAllowSearch": true,
  "maxTokens": 200000,
  "model": "claude-sonnet-4-20250514"
}
```

---

## 相关文档

- [架构概述](./architecture-overview.md)
- [核心模块设计](./core-modules-design.md)
- [安全与部署配置](./security-deployment-config.md)

---

**文档维护**

本文档应该根据实际实施情况持续更新。如有任何疑问或建议，请联系项目维护者。

**版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-10 | Claude | 初始版本 |
| 2.0 | 2026-01-11 | Claude | 统一工作目录方案，简化目录结构 |
| 2.1 | 2026-01-11 | Claude | 修正数据库位置：全局数据库位于宿主机 workspace/database，容器内无数据库 |
| 3.0 | 2026-01-12 | Claude | 基于官方文档更新 .claude 目录结构，添加配置作用域说明，添加路径映射规范 |
| 3.1 | 2026-01-12 | Claude | 明确容器内 HOME=/workspace 方案，统一路径映射，确保 ~/.claude/ 符合 Claude Code 官方标准 |
| 3.2 | 2026-01-18 | Claude | 更新文档标题和版本信息 |
