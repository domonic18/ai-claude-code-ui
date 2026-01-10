# 阶段1：基础设施准备

本文档说明多用户容器隔离系统阶段1的实施内容。

## 概述

阶段1主要包括以下内容：
1. 容器镜像构建（Dockerfile）
2. 容器安全策略配置（Seccomp + AppArmor）
3. 数据库表结构扩展
4. Docker Compose 配置

## 文件结构

```
ai-claude-code-ui/
├── Dockerfile.runtime                    # 容器镜像构建文件
├── docker-compose.yml                    # Docker Compose 配置
├── server/
│   ├── container-entrypoint.js          # 容器入口点脚本
│   └── database/
│       ├── db.js                        # 数据库操作（已更新）
│       ├── init.sql                     # 数据库初始化脚本
│       └── auth.db                      # SQLite 数据库文件
└── workspace/                            # 持久化数据目录（与代码分离）
    ├── containers/
    │   ├── seccomp/
    │   │   └── claude-code.json         # Seccomp 安全策略
    │   └── apparmor/
    │       └── docker-claude-code       # AppArmor 安全配置
    └── database/
        └── migrations/
            ├── 001_add_container_support.sql
            └── 002_create_containers_tables.sql
```

## 1. 容器镜像（Dockerfile）

### 文件：`Dockerfile.runtime`

这是一个多阶段构建的 Dockerfile，用于创建 Claude Code 运行时容器镜像。

**主要特性：**
- 基于 Node.js 20.x LTS
- 包含 Claude Code CLI
- 安装必要的系统依赖
- 创建非 root 用户运行
- 提供健康检查接口

**构建镜像：**
```bash
docker build -f Dockerfile.runtime -t claude-code-runtime:latest .
```

**测试镜像：**
```bash
docker run --rm -p 3001:3001 claude-code-runtime:latest
```

**验证健康检查：**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/info
```

## 2. 容器安全策略

### 2.1 Seccomp 配置

**文件：** `workspace/containers/seccomp/claude-code.json`

Seccomp（Secure Computing Mode）是 Linux 内核的安全特性，用于限制进程可以执行的系统调用。

**特点：**
- 默认拒绝所有系统调用
- 明确允许需要的系统调用
- 拒绝危险系统调用（mount, ptrace, kexec_load 等）

**使用方法：**
```bash
docker run --security-opt seccomp=workspace/containers/seccomp/claude-code.json claude-code-runtime:latest
```

**验证 Seccomp：**
```bash
# 检查系统是否支持 Seccomp
cat /proc/self/status | grep Seccomp

# 验证策略是否生效
docker inspect <container-id> | grep -A 10 SecurityOpt
```

### 2.2 AppArmor 配置

**文件：** `workspace/containers/apparmor/docker-claude-code`

AppArmor 是一个 Linux 安全模块，通过配置文件限制程序的访问权限。

**特点：**
- 限制文件系统访问
- 限制网络访问
- 拒绝访问敏感系统目录
- 拒绝访问 Docker socket

**安装和加载：**
```bash
# 安装 AppArmor（Ubuntu/Debian）
sudo apt-get install apparmor apparmor-utils

# 复制配置文件
sudo cp workspace/containers/apparmor/docker-claude-code /etc/apparmor.d/

# 加载配置
sudo apparmor_parser -r /etc/apparmor.d/docker-claude-code

# 验证状态
sudo aa-status
```

**使用方法：**
```bash
docker run --security-opt apparmor=docker-claude-code claude-code-runtime:latest
```

## 3. 数据库扩展

### 3.1 新增表结构

**用户表扩展字段：**
- `container_tier`: 用户等级（free/pro/enterprise）
- `container_config`: 容器配置（JSON）
- `resource_quota`: 资源配额（JSON）

**新增表：**

**user_containers（用户容器表）**
```sql
CREATE TABLE user_containers (
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

**container_metrics（容器指标表）**
```sql
CREATE TABLE container_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,
  cpu_percent REAL,
  memory_used INTEGER,
  memory_limit INTEGER,
  memory_percent REAL,
  disk_used INTEGER,
  network_rx INTEGER,
  network_tx INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (container_id) REFERENCES user_containers(container_id) ON DELETE CASCADE
);
```

### 3.2 数据库操作 API

**新增数据库模块：**

```javascript
import { containersDb, containerMetricsDb, userDb } from './server/database/db.js';

// 用户容器操作
await containersDb.createContainer(userId, containerId, containerName);
const container = await containersDb.getContainerByUserId(userId);
await containersDb.updateContainerStatus(containerId, 'running');
await containersDb.updateContainerLastActive(containerId);

// 容器指标操作
await containerMetricsDb.recordMetrics(containerId, metrics);
const metrics = await containerMetricsDb.getRecentMetrics(containerId, 100);
await containerMetricsDb.deleteOldMetrics(7);

// 用户等级操作
await userDb.updateContainerTier(userId, 'pro');
const tier = await userDb.getContainerTier(userId);
```

## 4. Docker Compose 配置

### 文件：`docker-compose.yml`

提供完整的容器编排配置，包括：

- **app**: 主应用服务
- **db**: PostgreSQL 数据库（可选）
- **nginx**: 反向代理（可选）
- **prometheus**: 监控指标收集（可选）
- **grafana**: 监控可视化（可选）

**基础使用：**
```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

**启用监控：**
```bash
docker-compose --profile monitoring up -d
```

## 5. 验收标准

阶段1完成后的验收标准：

### M1: 基础设施就绪

- [ ] Docker 镜像构建成功
  ```bash
  docker build -f Dockerfile.runtime -t claude-code-runtime:latest .
  docker images | grep claude-code-runtime
  ```

- [ ] 容器可以正常启动
  ```bash
  docker run --rm claude-code-runtime:latest
  # 应该看到健康检查服务器启动
  ```

- [ ] 健康检查接口正常
  ```bash
  docker run --rm -p 3001:3001 claude-code-runtime:latest
  curl http://localhost:3001/health
  curl http://localhost:3001/info
  ```

- [ ] Seccomp 策略生效
  ```bash
  docker run --rm --security-opt seccomp=workspace/containers/seccomp/claude-code.json claude-code-runtime:latest
  # 容器应该正常运行，但无法执行被禁止的系统调用
  ```

- [ ] AppArmor 配置可用（Linux）
  ```bash
  sudo aa-status | grep docker-claude-code
  # 应该能看到配置已加载
  ```

- [ ] 数据库迁移成功
  ```bash
  # 启动应用，检查迁移日志
  # 应该看到 "Adding container_tier column" 等消息
  ```

- [ ] 新表创建成功
  ```bash
  sqlite3 server/database/auth.db ".tables"
  # 应该看到 user_containers 和 container_metrics 表
  ```

## 6. 故障排查

### 容器无法启动

```bash
# 查看容器日志
docker logs <container-id>

# 进入容器调试
docker run -it --entrypoint /bin/bash claude-code-runtime:latest
```

### Seccomp 错误

```bash
# 检查 Seccomp 配置文件
cat workspace/containers/seccomp/claude-code.json | jq .

# 临时禁用 Seccomp 测试
docker run --rm --security-opt seccomp=unconfined claude-code-runtime:latest
```

### AppArmor 错误

```bash
# 查看 AppArmor 日志
sudo journalctl -f | grep apparmor

# 检查配置文件语法
sudo apparmor_parser -R workspace/containers/apparmor/docker-claude-code

# 临时禁用 AppArmor 测试
docker run --rm --security-opt apparmor=unconfined claude-code-runtime:latest
```

### 数据库迁移问题

```bash
# 检查数据库文件
ls -la server/database/auth.db

# 手动运行迁移
sqlite3 server/database/auth.db ".schema user_containers"
sqlite3 server/database/auth.db ".schema container_metrics"
```

## 7. 下一步

阶段1完成后，继续进行**阶段2：核心功能开发**

- 容器管理器（ContainerManager）
- Claude SDK 容器化
- PTY 容器化

详细内容请参考：`docs/multi-user-sandbox-architecture-design.md`
