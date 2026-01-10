# 多用户 Claude Code 系统 - 数据存储设计

> **文档版本**: 1.0
> **创建时间**: 2026-01-10
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、存储架构概览](#一存储架构概览)
- [二、Docker Volume 设计](#二docker-volume-设计)
- [三、数据库设计](#三数据库设计)
- [四、容器数据持久化策略](#四容器数据持久化策略)

---

## 一、存储架构概览

### 1.1 宿主机存储结构

```
宿主机存储结构:
/
├── /path/to/ai-claude-code-ui/                 # 项目根目录
│   ├── server/                                 # 服务端代码
│   ├── src/                                    # 前端代码
│   ├── dist/                                   # 构建产物
│   ├── workspace/                              # 持久化数据目录（与代码分离）
│   │   ├── database/                           # 数据库文件
│   │   │   └── claude-code.db                  # 用户认证数据
│   │   ├── users/                              # 用户数据目录
│   │   │   ├── user_1/                         # 用户 1 数据
│   │   │   │   ├── data/                       # 工作数据目录 (挂载到容器)
│   │   │   │   ├── projects/                   # Claude 项目数据
│   │   │   │   ├── config/                     # 用户配置
│   │   │   │   └── logs/                       # 用户日志
│   │   │   ├── user_2/                         # 用户 2 数据
│   │   │   └── ...
│   │   ├── containers/                         # 容器配置
│   │   │   ├── seccomp/                        # Seccomp 策略
│   │   │   │   └── claude-code.json           # 默认策略
│   │   │   └── apparmor/                       # AppArmor 配置
│   │   ├── cache/                              # 缓存数据
│   │   │   └── container-pool/                 # 容器预热池
│   │   ├── logs/                               # 系统日志
│   │   │   ├── container-manager.log           # 容器管理日志
│   │   │   └── container-*.log                 # 各容器日志
│   │   └── backups/                            # 备份目录
│   │       ├── daily/                          # 每日备份
│   │       ├── weekly/                         # 每周备份
│   │       └── monthly/                        # 每月备份
```

### 1.2 设计原则

1. **数据与代码分离**：将用户数据存储在 `workspace/` 目录下，与代码仓库分离
2. **用户数据隔离**：每个用户拥有独立的数据目录
3. **容器卷挂载**：使用 Docker Volume 实现容器内外数据共享
4. **定期备份**：自动化备份策略，防止数据丢失
5. **日志分离**：系统日志和用户日志分开存储

---

## 二、Docker Volume 设计

### 2.1 用户工作目录卷

#### 2.1.1 卷配置

```javascript
// 为每个用户创建专属的 Docker Volume
// 使用项目根目录下的 ./workspace 目录
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const createUserVolume = (userId) => ({
  name: `claude-user-${userId}`,
  driver: 'local',
  driverOpts: {
    type: 'none',
    device: path.join(PROJECT_ROOT, 'workspace', 'users', `user_${userId}`, 'data'),
    o: 'bind'
  }
});
```

#### 2.1.2 挂载点映射

| 宿主机路径 | 容器内路径 | 说明 |
|-----------|-----------|------|
| `./workspace/users/user_{id}/data` | `/workspace` | 用户工作目录 |
| `./workspace/users/user_{id}/projects` | `/root/.claude/projects` | Claude 项目数据 |

### 2.2 共享配置卷

```javascript
// 共享配置卷（只读）
const sharedConfigVolume = {
  name: 'claude-shared-config',
  driver: 'local',
  // 包含默认配置、CA 证书等
};
```

### 2.3 卷管理策略

#### 创建策略
- 用户首次登录时自动创建专属 Volume
- 使用 bind mount 模式，数据直接存储在宿主机
- 避免使用 Docker 管理的 Volume，便于备份和恢复

#### 删除策略
- 用户删除账户时，可选择删除或保留 Volume
- 容器销毁时不自动删除 Volume，保护用户数据
- 提供手动清理工具，定期清理孤儿 Volume

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
  volumeName: 'claude-user-1',
  networkName: 'claude-network-1',
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

| 数据类型 | 存储位置 | 持久化策略 | 备份策略 |
|---------|---------|-----------|---------|
| 用户代码 | `/workspace` | Docker Volume | 每日备份 |
| Claude 项目 | `/root/.claude/projects` | Docker Volume | 每日备份 |
| 会话历史 | 宿主机 SQLite | 持久化 | 每日备份 |
| 临时文件 | 容器内 `/tmp` | 容器销毁时删除 | 不备份 |
| 构建产物 | `/workspace/node_modules` | Docker Volume | 按需备份 |

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
  sourceDir: path.join(PROJECT_ROOT, 'workspace'),
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

  tar -czf "$backup_file" -C "$user_dir" .

  # 验证备份
  if [ $? -eq 0 ]; then
    echo "Backup successful: $backup_file"
  else
    echo "Backup failed: $user_name"
  fi
done

# 备份数据库
cp "${WORKSPACE_DIR}/database/claude-code.db" "${BACKUP_DIR}/daily/db_${DATE}.db"

# 清理过期备份
find "${BACKUP_DIR}/daily" -name "*.tar.gz" -mtime +7 -delete
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

USER_DIR="${PROJECT_ROOT}/workspace/users/user_${USER_ID}"

# 停止用户容器
docker stop "claude-user-${USER_ID}"

# 恢复数据
mkdir -p "$USER_DIR"
tar -xzf "$BACKUP_FILE" -C "$USER_DIR"

# 重启容器
docker start "claude-user-${USER_ID}"

echo "Restore completed for user ${USER_ID}"
```

### 4.4 存储容量管理

#### 4.4.1 容量监控

```javascript
// 存储容量监控脚本
import fs from 'fs';
import path from 'path';

function checkStorageUsage() {
  const workspaceDir = path.join(PROJECT_ROOT, 'workspace');

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
  const usersDir = path.join(workspaceDir, 'users');
  const userDirs = fs.readdirSync(usersDir);

  for (const userDir of userDirs) {
    const userPath = path.join(usersDir, userDir);
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
