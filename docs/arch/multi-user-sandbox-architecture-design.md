# 多用户 Claude Code 系统 - Docker 沙箱隔离架构设计

> **文档版本**: 1.0
> **创建时间**: 2026-01-10
> **方案类型**: 方案A - Docker + Seccomp 容器隔离
> **项目版本**: 基于 main 分支 (commit: d1e46a5)

---

## 目录

- [一、架构概述](#一架构概述)
- [二、整体架构设计](#二整体架构设计)
- [三、数据存储设计](#三数据存储设计)
- [四、核心实现流程](#四核心实现流程)
- [五、模块详细设计](#五模块详细设计)
- [六、安全策略配置](#六安全策略配置)
- [七、部署架构](#七部署架构)
- [八、实施计划](#八实施计划)

---

## 一、架构概述

### 1.1 设计目标

将当前的单用户 Claude Code 执行系统改造为**多用户容器隔离系统**，实现：

1. **用户间完全隔离**：每个用户拥有独立的执行环境
2. **宿主机安全保护**：防止用户代码逃逸沙箱威胁宿主机
3. **资源可控**：CPU、内存、磁盘等资源可限制
4. **高可用性**：支持容器故障恢复和自动重启
5. **可扩展性**：支持横向扩展和负载均衡

### 1.2 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 容器运行时 | Docker 24.x | 成熟稳定的容器技术 |
| 安全策略 | Seccomp + AppArmor | 系统调用过滤和强制访问控制 |
| 容器编排 | Docker Compose (起步) | 简化部署和管理 |
| 网络隔离 | Docker Bridge + User Network | 容器间网络隔离 |
| 存储卷 | Docker Volume | 持久化用户数据 |
| 容器管理 | Dockerode (Node.js) | Docker API 封装 |

### 1.3 架构原则

- **最小权限原则**：容器仅拥有执行任务所需的最小权限
- **防御深度原则**：多层安全防护（容器+Seccomp+AppArmor+网络隔离）
- **故障隔离原则**：单个容器故障不影响其他用户
- **资源配额原则**：严格限制每个用户的资源使用

---

## 二、整体架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              宿主机 (Host Machine)                            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    主应用 (Express + React)                            │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │  │
│  │  │  HTTP Server   │  │ WebSocket (ws) │  │  SQLite DB     │          │  │
│  │  │   (Express)    │  │                │  │  (用户认证)     │          │  │
│  │  └────────┬───────┘  └───────┬────────┘  └────────────────┘          │  │
│  └───────────┼──────────────────┼───────────────────────────────────────┘  │
│              │                  │                                              │
│  ┌───────────▼──────────────────▼───────────────────────────────────────┐  │
│  │              容器管理中间层 (Container Management Layer)              │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │           ContainerManager (server/container-manager.js)        │  │  │
│  │  │  - 容器生命周期管理                                              │  │  │
│  │  │  - 容器池管理                                                     │  │  │
│  │  │  - 资源监控和配额                                                 │  │  │
│  │  └────────────────────┬───────────────────────────────────────────┘  │  │
│  └───────────────────────┼──────────────────────────────────────────────┘  │
│                          │                                                   │
│              ┌───────────┼───────────┐                                       │
│              │           │           │
│  ┌───────────▼──┐  ┌────▼─────┐  ┌─▼──────────┐
│  │  用户A容器    │  │ 用户B容器 │  │  用户C容器   │
│  │  ┌────────┐  │  │ ┌──────┐ │  │  ┌───────┐  │
│  │  │node-pty│  │  │ │node- │ │  │  │node-  │  │
│  │  │(终端)  │  │  │ │pty   │ │  │  │pty    │  │
│  │  └────────┘  │  │ └──────┘ │  │  └───────┘  │
│  │  ┌────────┐  │  │ ┌──────┐ │  │  ┌───────┐  │
│  │  │Claude  │  │  │ │Claude│ │  │  │Claude │  │
│  │  │SDK     │  │  │ │SDK   │ │  │  │SDK    │  │
│  │  └────────┘  │  │ └──────┘ │  │  └───────┘  │
│  │  ┌────────┐  │  │ ┌──────┐ │  │  ┌───────┐  │
│  │  │/workspace│ │  │ │/work-│ │  │  │/work-  │  │
│  │  │(用户A)  │  │  │ │space │ │  │  │space   │  │
│  │  └────────┘  │  │ │(用户B)│ │  │  │(用户C)  │  │
│  └──────────────┘  │ └──────┘ │  │  └───────┘  │
│                    └──────────┘  └─────────────┘
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Docker Daemon                                     │  │
│  │  - 容器创建/启动/停止                                                   │  │
│  │  - 镜像管理                                                            │  │
│  │  - 网络管理                                                            │  │
│  │  - 存储卷管理                                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 分层架构说明

#### 2.2.1 应用层 (Application Layer)

**主应用**：保持现有的 Express + React 架构

- **HTTP Server**：处理 REST API 请求
- **WebSocket Server**：处理实时通信（聊天和终端）
- **SQLite DB**：用户认证和会话管理

**主要文件**：
- `server/index.js` - 主服务入口
- `server/claude-sdk.js` - Claude SDK 集成（需改造）
- `server/routes/*` - API 路由

#### 2.2.2 容器管理层 (Container Management Layer)

**新增模块**：负责容器生命周期管理

**核心模块**：`server/container-manager.js`

```javascript
class ContainerManager {
  // 容器池管理
  containerPool: Map<userId, containerInfo>

  // 核心方法
  async getOrCreateContainer(userId, userTier)
  async destroyContainer(userId)
  async executeInContainer(userId, command)
  async getContainerStats(userId)
  async cleanupIdleContainers()
}
```

#### 2.2.3 容器执行层 (Container Execution Layer)

**用户容器**：每个用户的独立执行环境

**容器内容**：
- **node-pty**：终端进程
- **Claude SDK**：AI 代理执行
- **工作目录**：`/workspace` (用户专属文件系统)
- **运行时**：Node.js 20.x

### 2.3 通信流程图

```
┌──────────┐         ┌──────────────┐         ┌─────────────┐
│ 前端用户   │ ──────▶│  主应用       │ ──────▶│  用户容器     │
│ (Browser) │         │  (Express)   │         │  (Docker)   │
└──────────┘         └──────────────┘         └─────────────┘
     │                      │                         │
     │  1. WebSocket 连接     │                         │
     ├────────────────────▶│                         │
     │                      │                         │
     │                      │  2. 获取/创建容器         │
     │                      ├─────────────────────▶│
     │                      │                         │
     │                      │  3. 容器就绪响应         │
     │                      │◀─────────────────────┤
     │                      │                         │
     │  4. 发送命令/输入      │                         │
     ├────────────────────▶│                         │
     │                      │  5. 转发到容器           │
     │                      ├─────────────────────▶│
     │                      │                         │
     │                      │  6. 容器内执行           │
     │                      │  (Claude SDK / PTY)     │
     │                      │                         │
     │                      │  7. 流式输出响应         │
     │                      │◀─────────────────────┤
     │  8. 流式响应前端      │                         │
     │◀─────────────────────┤                         │
     │                      │                         │
```

---

## 三、数据存储设计

### 3.1 存储架构概览

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

### 3.2 Docker Volume 设计

#### 3.2.1 用户工作目录卷

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

**挂载点映射**：

| 宿主机路径                    | 容器内路径    | 说明           |
|------------------------------|--------------|----------------|
| `./workspace/users/user_{id}/data` | `/workspace`  | 用户工作目录     |
| `./workspace/users/user_{id}/projects`  | `/root/.claude/projects` | Claude 项目数据 |

#### 3.2.2 共享配置卷

```javascript
// 共享配置卷（只读）
const sharedConfigVolume = {
  name: 'claude-shared-config',
  driver: 'local',
  // 包含默认配置、CA 证书等
};
```

### 3.3 数据库设计

#### 3.3.1 用户表扩展

在现有 `users` 表基础上添加容器相关字段：

```sql
-- 新增字段到 users 表
ALTER TABLE users ADD COLUMN container_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN container_config TEXT;
ALTER TABLE users ADD COLUMN resource_quota TEXT;

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

#### 3.3.2 数据模型示例

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

### 3.4 容器数据持久化策略

#### 3.4.1 数据分类处理

| 数据类型 | 存储位置 | 持久化策略 | 备份策略 |
|---------|---------|-----------|---------|
| 用户代码 | `/workspace` | Docker Volume | 每日备份 |
| Claude 项目 | `/root/.claude/projects` | Docker Volume | 每日备份 |
| 会话历史 | 宿主机 SQLite | 持久化 | 每日备份 |
| 临时文件 | 容器内 `/tmp` | 容器销毁时删除 | 不备份 |
| 构建产物 | `/workspace/node_modules` | Docker Volume | 按需备份 |

#### 3.4.2 备份策略

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

---

## 四、核心实现流程

### 4.1 用户认证与容器初始化流程

```
┌─────────────┐
│ 用户登录      │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│ 1. 验证用户凭证 (JWT)                                       │
│    POST /api/auth/login                                    │
│    - 验证用户名和密码                                        │
│    - 生成 JWT Token                                        │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 2. 用户首次登录 - 容器初始化                                │
│    - 检查用户是否有活跃容器                                 │
│    - 如果没有，创建新容器                                    │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 创建用户容器                                            │
│    a) 创建 Docker Volume                                   │
│    b) 创建用户专属网络（可选）                               │
│    c) 创建并启动容器                                        │
│    d) 配置资源限制                                          │
│    e) 应用安全策略                                          │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 容器健康检查                                            │
│    - 等待容器就绪                                          │
│    - 验证服务可用性                                        │
│    - 记录容器状态到数据库                                   │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 5. 返回访问令牌和容器信息                                   │
│    {                                                       │
│      token: "jwt_token",                                  │
│      containerReady: true,                                │
│      workspacePath: "/workspace"                          │
│    }                                                      │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Claude SDK 容器执行流程

```
┌─────────────┐
│ 前端发送请求  │
│ Claude 命令  │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│ 1. WebSocket 连接                                          │
│    ws://host/ws?token=xxx                                  │
│    - 验证 JWT Token                                        │
│    - 获取用户信息                                          │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 2. 获取用户容器                                            │
│    containerManager.getOrCreateContainer(userId)          │
│    - 检查容器是否运行                                      │
│    - 如果未运行，启动容器                                   │
│    - 如果不存在，创建新容器                                 │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 在容器内执行 Claude SDK                                 │
│    docker exec containerId node claude-sdk.js ...         │
│    - 将命令转发到容器内执行                                 │
│    - 设置工作目录为 /workspace                             │
│    - 传递环境变量和配置                                    │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 流式输出处理                                            │
│    - 容器内 Claude SDK 生成输出                             │
│    - 通过 WebSocket 流式传输到前端                          │
│    - 支持实时进度显示                                      │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 5. 会话结束处理                                            │
│    - 更新最后活跃时间                                      │
│    - 清理临时文件                                          │
│    - 保留容器用于后续会话                                   │
└───────────────────────────────────────────────────────────┘
```

### 4.3 终端 (PTY) 容器执行流程

```
┌─────────────┐
│ 前端请求终端  │
│ 会话         │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│ 1. WebSocket 连接 (/shell)                                 │
│    - 验证 JWT Token                                        │
│    - 获取用户容器                                          │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 2. 在容器内创建 PTY 会话                                    │
│    docker exec -it containerId node pty-wrapper.js        │
│    - 创建 node-pty 会话                                    │
│    - 设置终端尺寸                                          │
│    - 绑定输入输出流                                        │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 双向数据流                                              │
│    前端 ←→ WebSocket ←→ 容器 PTY ←→ Shell                  │
│    - 用户输入转发到容器 PTY                                 │
│    - PTY 输出流式传输到前端                                 │
│    - 支持终端颜色和格式                                     │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 会话管理                                                │
│    - 会话超时机制（30 分钟）                                │
│    - 会话恢复（重连时复用）                                 │
│    - 会话清理（超时后销毁）                                 │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 5. 终端断开处理                                            │
│    - 保留 PTY 会话（30 分钟）                               │
│    - 超时后自动清理                                        │
└───────────────────────────────────────────────────────────┘
```

### 4.4 文件操作容器化流程

```
┌─────────────┐
│ 前端请求文件  │
│ 操作         │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│ 1. 文件读取请求                                            │
│    GET /api/projects/:projectName/file?filePath=xxx       │
│    - 验证用户权限                                          │
│    - 验证路径安全性                                        │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 2. 路径转换与验证                                          │
│    - 将项目路径转换为容器内路径                             │
│    - /workspace/xxx                                       │
│    - 验证路径在 /workspace 内                               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 容器内文件操作                                          │
│    docker exec containerId cat /workspace/xxx             │
│    或                                                       │
│    docker cp containerId:/workspace/xxx -                 │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 返回文件内容                                            │
│    - 读取容器内文件                                        │
│    - 通过 API 返回给前端                                   │
└───────────────────────────┬───────────────────────────────┘
```

### 4.5 容器生命周期管理流程

```
┌───────────────────────────────────────────────────────────┐
│                      容器生命周期                           │
└───────────────────────────────────────────────────────────┘

创建状态:
┌──────┐    ┌────────┐    ┌──────────┐    ┌─────────┐
│ 创建  │───▶│ 配置    │───▶│ 启动      │───▶│ 运行中   │
└──────┘    └────────┘    └──────────┘    └─────────┘
                                          │
                                          │ 超时/停止
                                          ▼
                                   ┌──────────┐
                                   │ 暂停      │
                                   └──────────┘
                                          │
                                          │ 重启/恢复
                                          ▼
                                   ┌─────────┐
                                   │ 运行中   │
                                   └─────────┘
                                          │
                                          │ 销毁
                                          ▼
                                   ┌──────────┐
                                   │ 已删除   │
                                   └──────────┘

容器状态管理:
- creating: 容器正在创建
- starting: 容器正在启动
- running: 容器运行中
- paused: 容器已暂停
- stopping: 容器正在停止
- stopped: 容器已停止
- removing: 容器正在删除
- removed: 容器已删除
```

---

## 五、模块详细设计

### 5.1 容器管理器 (ContainerManager)

#### 5.1.1 模块结构

```javascript
/**
 * server/container-manager.js
 *
 * 容器生命周期管理模块
 */

import Docker from 'dockerode';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

class ContainerManager {
  constructor(options = {}) {
    this.docker = new Docker({
      socketPath: options.socketPath || '/var/run/docker.sock'
    });

    // 容器池缓存
    this.containers = new Map();  // userId -> containerInfo

    // 配置（使用项目根目录下的 ./workspace 目录）
    this.config = {
      dataDir: options.dataDir || path.join(PROJECT_ROOT, 'workspace'),
      image: options.image || 'claude-code-runtime:latest',
      network: options.network || 'bridge',
      ...options
    };
  }

  /**
   * 获取或创建用户容器
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>}
   */
  async getOrCreateContainer(userId, userConfig = {}) {
    // 检查缓存中是否已有容器
    if (this.containers.has(userId)) {
      const container = this.containers.get(userId);
      const status = await this.getContainerStatus(container.id);

      if (status === 'running') {
        return container;
      }

      // 容器未运行，清理缓存
      this.containers.delete(userId);
    }

    // 创建新容器
    return await this.createContainer(userId, userConfig);
  }

  /**
   * 创建用户容器
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>}
   */
  async createContainer(userId, userConfig) {
    const containerName = `claude-user-${userId}`;
    const volumeName = `claude-user-${userId}`;
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    // 1. 创建 Docker Volume
    await this.createVolume(volumeName, userDataDir);

    // 2. 创建用户网络（可选，用于网络隔离）
    const networkName = userConfig.isolatedNetwork
      ? await this.createUserNetwork(userId)
      : this.config.network;

    // 3. 创建容器配置
    const containerConfig = this.buildContainerConfig({
      name: containerName,
      volumeName,
      networkName,
      userId,
      userConfig
    });

    // 4. 创建并启动容器
    const container = await this.docker.createContainer(containerConfig);
    await container.start();

    // 5. 等待容器就绪
    await this.waitForContainerReady(container.id);

    // 6. 缓存容器信息
    const containerInfo = {
      id: container.id,
      name: containerName,
      userId,
      status: 'running',
      createdAt: new Date(),
      lastActive: new Date()
    };

    this.containers.set(userId, containerInfo);

    return containerInfo;
  }

  /**
   * 构建容器配置
   * @param {object} options - 配置选项
   * @returns {object} Docker 容器配置
   */
  buildContainerConfig(options) {
    const { name, volumeName, networkName, userId, userConfig } = options;
    const resourceLimits = this.getResourceLimits(userConfig.tier || 'free');

    return {
      name: name,
      Image: this.config.image,
      Env: [
        `USER_ID=${userId}`,
        `NODE_ENV=production`,
        `USER_TIER=${userConfig.tier || 'free'}`
      ],
      HostConfig: {
        Binds: [
          `${volumeName}:/workspace:rw`,                    // 用户工作目录
          `${volumeName}-projects:/root/.claude/projects:rw` // Claude 项目数据
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        NetworkMode: networkName,
        SecurityOpt: resourceLimits.securityOptions,
        ReadonlyRootfs: false,  // 允许写入
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '3'
          }
        }
      },
      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {}
        }
      },
      Labels: {
        'com.claude-code.user': String(userId),
        'com.claude-code.managed': 'true',
        'com.claude-code.created': new Date().toISOString()
      }
    };
  }

  /**
   * 获取资源限制配置
   * @param {string} tier - 用户等级
   * @returns {object} 资源限制配置
   */
  getResourceLimits(tier) {
    const limits = {
      free: {
        memory: 1 * 1024 * 1024 * 1024,  // 1GB
        cpuQuota: 50000,                  // 0.5 CPU
        cpuPeriod: 100000,
        securityOptions: [
          'apparmor=docker-default',
          'seccomp=claude-code-default.json'
        ]
      },
      pro: {
        memory: 4 * 1024 * 1024 * 1024,  // 4GB
        cpuQuota: 200000,                 // 2 CPU
        cpuPeriod: 100000,
        securityOptions: [
          'apparmor=docker-default',
          'seccomp=claude-code-default.json'
        ]
      },
      enterprise: {
        memory: 8 * 1024 * 1024 * 1024,  // 8GB
        cpuQuota: 400000,                 // 4 CPU
        cpuPeriod: 100000,
        securityOptions: [
          'apparmor=docker-default',
          'seccomp=claude-code-enterprise.json'
        ]
      }
    };

    return limits[tier] || limits.free;
  }

  /**
   * 在容器内执行命令
   * @param {number} userId - 用户 ID
   * @param {string} command - 要执行的命令
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行结果
   */
  async execInContainer(userId, command, options = {}) {
    const container = await this.getOrCreateContainer(userId);
    const exec = await this.docker.getContainer(container.id).exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: options.cwd || '/workspace',
      Env: options.env || []
    });

    const stream = await exec.start({ Detach: false });
    return stream;
  }

  /**
   * 销毁用户容器
   * @param {number} userId - 用户 ID
   */
  async destroyContainer(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    const container = this.docker.getContainer(containerInfo.id);

    // 停止容器
    await container.stop({ t: 10 });  // 10秒超时

    // 删除容器
    await container.remove();

    // 从缓存中移除
    this.containers.delete(userId);
  }

  /**
   * 获取容器状态
   * @param {string} containerId - 容器 ID
   * @returns {Promise<string>} 容器状态
   */
  async getContainerStatus(containerId) {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  }

  /**
   * 等待容器就绪
   * @param {string} containerId - 容器 ID
   * @param {number} timeout - 超时时间（毫秒）
   */
  async waitForContainerReady(containerId, timeout = 60000) {
    const startTime = Date.now();
    const container = this.docker.getContainer(containerId);

    while (Date.now() - startTime < timeout) {
      const info = await container.inspect();
      if (info.State.Status === 'running' && info.State.Health.Status === 'healthy') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Container failed to become ready');
  }

  /**
   * 创建 Docker Volume
   * @param {string} volumeName - Volume 名称
   * @param {string} hostPath - 宿主机路径
   */
  async createVolume(volumeName, hostPath) {
    // 确保宿主机目录存在
    await fs.promises.mkdir(hostPath, { recursive: true });

    try {
      await this.docker.createVolume({
        Name: volumeName,
        Driver: 'local',
        DriverOpts: {
          type: 'none',
          device: hostPath,
          o: 'bind'
        }
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  /**
   * 创建用户专属网络
   * @param {number} userId - 用户 ID
   * @returns {Promise<string>} 网络名称
   */
  async createUserNetwork(userId) {
    const networkName = `claude-network-${userId}`;

    try {
      await this.docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Internal: false,  // 允许访问外网
        IPAM: {
          Config: [{
            Subnet: `10.${userId % 256}.0.0/24`
          }]
        }
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    return networkName;
  }

  /**
   * 清理空闲容器
   * @param {number} idleTime - 空闲时间（毫秒）
   */
  async cleanupIdleContainers(idleTime = 2 * 60 * 60 * 1000) {  // 默认2小时
    const now = Date.now();
    const containers = await this.docker.listContainers({ all: true });

    for (const containerInfo of containers) {
      const labels = containerInfo.Labels;
      if (labels['com.claude-code.managed'] !== 'true') {
        continue;
      }

      const container = this.docker.getContainer(containerInfo.Id);
      const info = await container.inspect();

      // 检查最后活跃时间
      const lastActive = new Date(info.State.StartedAt).getTime();
      if (now - lastActive > idleTime) {
        const userId = labels['com.claude-code.user'];
        await this.destroyContainer(userId);
      }
    }
  }

  /**
   * 获取容器统计信息
   * @param {number} userId - 用户 ID
   * @returns {Promise<object>} 容器统计信息
   */
  async getContainerStats(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      throw new Error('Container not found');
    }

    const container = this.docker.getContainer(containerInfo.id);
    const stats = await container.stats({ stream: false });

    return {
      cpuPercent: this.calculateCPUPercent(stats),
      memoryUsage: stats.memory_stats.usage,
      memoryLimit: stats.memory_stats.limit,
      memoryPercent: (stats.memory_stats.usage / stats.memory_stats.limit) * 100,
      networkRx: stats.networks?.eth0?.rx_bytes || 0,
      networkTx: stats.networks?.eth0?.tx_bytes || 0,
      blockRead: stats.blkio_stats?.io_service_bytes_recursive?.[0]?.value || 0,
      blockWrite: stats.blkio_stats?.io_service_bytes_recursive?.[1]?.value || 0
    };
  }

  /**
   * 计算 CPU 使用率
   * @param {object} stats - 容器统计信息
   * @returns {number} CPU 使用率
   */
  calculateCPUPercent(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    return Math.round(cpuPercent * 100) / 100;
  }
}

export default ContainerManager;
```

#### 5.1.2 使用示例

```javascript
// 在 server/index.js 中集成
import ContainerManager from './container-manager.js';

const containerManager = new ContainerManager({
  // 不传 dataDir，将自动使用项目根目录下的 ./workspace 目录
  image: 'claude-code-runtime:latest'
});

// WebSocket 连接处理时获取容器
ws.on('message', async (message) => {
  const data = JSON.parse(message);
  const userId = ws.user.id;

  // 获取或创建用户容器
  const container = await containerManager.getOrCreateContainer(userId, {
    tier: ws.user.tier || 'free'
  });

  // 在容器内执行命令
  if (data.type === 'claude-command') {
    await execInContainer(container.id, data.command);
  }
});
```

### 5.2 容器镜像设计 (Dockerfile)

#### 5.2.1 容器依赖说明

容器镜像需要包含以下核心依赖：

**1. Node.js 运行时**
- 版本：Node.js 20.x LTS
- 用途：运行 Claude SDK 和服务器代码

**2. Claude Code CLI**
- 安装方式：通过 npm 全局安装
- 版本：与主应用版本保持一致
- 用途：在容器内执行 Claude 命令

**3. 系统依赖包**
- `build-essential`: 编译工具链
- `git`: 版本控制
- `curl`/`wget`: 下载工具
- `bash`/`sh`: Shell 环境
- `python3`/`python3-pip`: Python 支持（某些 npm 包需要）
- `jq`: JSON 处理工具

#### 5.2.2 完整 Dockerfile

```dockerfile
# Dockerfile.claude-code-runtime
FROM node:20-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    vim \
    bash \
    python3 \
    python3-pip \
    jq \
    && rm -rf /var/lib/apt/lists/*

# 安装 Claude Code CLI（全局安装）
# 从项目本地的 package.json 安装，或从 npm registry 安装
RUN npm install -g @anthropic-ai/claude-code

# 验证安装
RUN claude --version && node --version

# 创建非 root 用户
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /workspace && \
    mkdir -p /root/.claude && \
    chown -R claude:claude /workspace && \
    chown -R claude:claude /root/.claude

# 复制应用文件
COPY package*.json ./
COPY server ./server
COPY shared ./shared

# 安装应用依赖
RUN npm ci --only=production

# 切换到非 root 用户
USER claude

# 设置工作目录为用户工作空间
WORKDIR /workspace

# 设置环境变量
ENV NODE_ENV=production
ENV CLAUDE_CONFIG_DIR=/root/.claude

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 暴露端口（如果需要）
EXPOSE 3001

# 默认命令 - 保持容器运行
CMD ["node", "/app/server/container-entrypoint.js"]
```

#### 5.2.3 多阶段构建优化版本

```dockerfile
# Dockerfile.claude-code-runtime（多阶段构建）
FROM node:20-slim AS builder

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY server ./server
COPY shared ./shared

# 安装依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 最终镜像
FROM node:20-slim

# 只安装运行时依赖
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    bash \
    jq \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 从 builder 阶段复制已安装的 node_modules
COPY --from=builder --chown=claude:claude /app /app

# 创建用户
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /workspace && \
    mkdir -p /root/.claude && \
    chown -R claude:claude /workspace /root/.claude /app

# 切换用户
USER claude

WORKDIR /workspace

ENV NODE_ENV=production
ENV CLAUDE_CONFIG_DIR=/root/.claude

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD claude --version || exit 1

EXPOSE 3001

CMD ["node", "/app/server/container-entrypoint.js"]
```

#### 5.2.4 容器入口点

```javascript
/**
 * server/container-entrypoint.js
 *
 * 容器内入口点脚本
 * - 提供健康检查接口
 * - 保持容器运行
 * - 初始化容器环境
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 初始化 Claude 配置目录
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || '/root/.claude';
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// 确保必要的目录存在
[CLAUDE_DIR, PROJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 创建简单的健康检查服务器
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // 检查 Claude CLI 是否可用
    const claudeCheck = spawn('claude', ['--version'], {
      stdio: 'pipe'
    });

    claudeCheck.on('close', (code) => {
      const isHealthy = code === 0;
      res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        claude: isHealthy ? 'available' : 'unavailable',
        node: process.version
      }));
    });
  } else if (req.url === '/info') {
    // 返回容器信息
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      workspace: process.cwd(),
      claudeConfigDir: CLAUDE_DIR
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.HEALTH_CHECK_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// 保持容器运行
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### 5.3 Claude SDK 容器化改造

#### 5.3.1 改造后的 claude-sdk.js

```javascript
/**
 * server/claude-sdk-container.js
 *
 * 容器化版本的 Claude SDK 集成
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import containerManager from './container-manager.js';

/**
 * 在容器内执行 Claude SDK 查询
 * @param {string} command - 用户命令
 * @param {object} options - 执行选项
 * @param {object} writer - 响应写入器
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  const { userId, sessionId, cwd, ...sdkOptions } = options;

  try {
    // 1. 获取用户容器
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: options.userTier || 'free'
    });

    // 2. 映射 SDK 选项
    const mappedOptions = mapCliOptionsToSDK({
      ...sdkOptions,
      sessionId,
      cwd: cwd ? `/workspace/${path.basename(cwd)}` : '/workspace'
    });

    // 3. 在容器内创建会话文件目录
    const claudeDir = `/root/.claude/projects/workspace-${sessionId}`;
    await containerManager.execInContainer(userId, `mkdir -p ${claudeDir}`);

    // 4. 在容器内执行 Claude SDK
    // 方式1: 直接通过 Docker exec 执行
    const execResult = await containerManager.execInContainer(
      userId,
      `cd /workspace && node -e "
        const { query } = require('@anthropic-ai/claude-agent-sdk');
        const options = ${JSON.stringify(mappedOptions)};
        query('${command}', options).then(result => {
          console.log(JSON.stringify(result));
        }).catch(error => {
          console.error(JSON.stringify({ error: error.message }));
        });
      "`,
      {
        cwd: '/workspace',
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          ...mappedOptions
        }
      }
    );

    // 5. 处理流式输出
    execResult.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        writer.send({
          type: 'content',
          content: data.content,
          sessionId
        });
      } catch (error) {
        // 非 JSON 输出，直接发送
        writer.send({
          type: 'output',
          data: chunk.toString(),
          sessionId
        });
      }
    });

    execResult.on('error', (error) => {
      writer.send({
        type: 'error',
        error: error.message,
        sessionId
      });
    });

    execResult.on('end', () => {
      writer.send({
        type: 'end',
        sessionId
      });
    });

  } catch (error) {
    writer.send({
      type: 'error',
      error: error.message
    });
  }
}

// 导出其他函数...
export { abortClaudeSDKSession, isClaudeSDKSessionActive, getActiveClaudeSDKSessions } from './claude-sdk.js';
```

### 5.4 PTY 容器化改造

#### 5.4.1 改造后的 PTY 处理

```javascript
/**
 * server/pty-container.js
 *
 * 容器化版本的 PTY 处理
 */

import pty from 'node-pty';
import containerManager from './container-manager.js';

/**
 * 在容器内创建 PTY 会话
 * @param {object} ws - WebSocket 连接
 * @param {object} options - PTY 选项
 */
export async function createPtyInContainer(ws, options) {
  const { userId, projectPath, sessionId, initialCommand, cols, rows } = options;

  try {
    // 1. 获取用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 2. 在容器内执行 PTY 包装器
    const ptySessionKey = `${projectPath}_${sessionId}`;
    const existingSession = ptySessionsMap.get(ptySessionKey);

    if (existingSession) {
      // 复用现有会话
      return existingSession;
    }

    // 3. 在容器内创建 PTY
    const shellCommand = buildShellCommand(projectPath, initialCommand);
    const exec = await containerManager.docker.getContainer(container.id).exec({
      Cmd: ['/bin/bash', '-c', shellCommand],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      WorkingDir: '/workspace',
      Env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3'
      }
    });

    // 4. 启动 exec 并创建流
    const stream = await exec.start({ Detach: false, Tty: true });

    // 5. 创建 PTY 会话
    const ptySession = {
      exec,
      stream,
      ws,
      buffer: [],
      userId,
      sessionId,
      containerId: container.id,
      timeoutId: null,
      createdAt: new Date()
    };

    // 6. 设置流处理
    stream.on('data', (data) => {
      const output = data.toString();

      // 缓存输出
      if (ptySession.buffer.length < 5000) {
        ptySession.buffer.push(output);
      } else {
        ptySession.buffer.shift();
        ptySession.buffer.push(output);
      }

      // 发送到前端
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'output',
          data: output
        }));
      }
    });

    stream.on('error', (error) => {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    });

    // 7. 缓存会话
    ptySessionsMap.set(ptySessionKey, ptySession);

    return ptySession;

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: `Failed to create PTY: ${error.message}`
    }));
  }
}

/**
 * 构建在容器内执行的 shell 命令
 */
function buildShellCommand(projectPath, initialCommand) {
  const workspaceProjectPath = projectPath.replace(/^.*:/, '/workspace');
  return `cd "${workspaceProjectPath}" && ${initialCommand || 'bash'}`;
}

/**
 * 向容器内 PTY 发送输入
 */
export async function sendInputToPty(userId, sessionId, input) {
  const sessionKey = `*_${sessionId}`;
  const session = ptySessionsMap.get(sessionKey);

  if (!session) {
    throw new Error('PTY session not found');
  }

  // 通过 Docker exec 输入流发送数据
  session.stream.write(input);
}

/**
 * 调整容器内 PTY 尺寸
 */
export async function resizePty(userId, sessionId, cols, rows) {
  const sessionKey = `*_${sessionId}`;
  const session = ptySessionsMap.get(sessionKey);

  if (!session || !session.exec) {
    return;
  }

  // Docker exec 不支持动态调整 PTY 尺寸
  // 需要使用其他方式（如 stty）
  await containerManager.execInContainer(
    userId,
    `stty cols ${cols} rows ${rows}`
  );
}
```

### 5.5 文件操作容器化

#### 5.5.1 文件读取改造

```javascript
/**
 * server/routes/projects-container.js
 *
 * 容器化版本的文件操作路由
 */

import express from 'express';
import containerManager from '../container-manager.js';

const router = express.Router();

/**
 * 读取文件（通过容器）
 */
router.get('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    const userId = req.user.id;

    // 1. 获取用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 2. 验证路径安全性
    const safePath = validatePath(filePath);

    // 3. 从容器读取文件
    const result = await containerManager.execInContainer(
      userId,
      `cat "/workspace/${safePath}"`
    );

    let content = '';
    result.on('data', (chunk) => {
      content += chunk.toString();
    });

    result.on('end', () => {
      res.json({ content, path: filePath });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 保存文件（通过容器）
 */
router.put('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    const userId = req.user.id;

    // 1. 获取用户容器
    await containerManager.getOrCreateContainer(userId);

    // 2. 验证路径安全性
    const safePath = validatePath(filePath);

    // 3. 将内容写入容器
    // 使用 heredoc 避免特殊字符问题
    const command = `cat > "/workspace/${safePath}" << 'EOF'\n${content}\nEOF`;

    await containerManager.execInContainer(userId, command);

    res.json({
      success: true,
      path: filePath,
      message: 'File saved successfully'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取文件树（通过容器）
 */
router.get('/:projectName/files', async (req, res) => {
  try {
    const { projectName } = req.params;
    const userId = req.user.id;

    // 1. 获取用户容器
    await containerManager.getOrCreateContainer(userId);

    // 2. 在容器内执行文件树命令
    const result = await containerManager.execInContainer(
      userId,
      `find /workspace -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -1000`
    );

    let files = [];
    result.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        files = output.split('\n').map(f => ({
          path: f.replace('/workspace/', ''),
          fullPath: f
        }));
      }
    });

    result.on('end', () => {
      res.json(files);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 验证路径安全性
 */
function validatePath(filePath) {
  // 移除路径遍历攻击
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  // 确保路径不以 / 开头（绝对路径）
  return normalized.replace(/^\//, '');
}

export default router;
```

### 5.6 WebSocket 连接管理

#### 5.6.1 多用户 WebSocket 架构

在多用户容器隔离系统中，WebSocket 连接管理是核心挑战之一。每个用户都有独立的容器环境，需要妥善管理前后端之间的 WebSocket 连接。

```
┌─────────────────────────────────────────────────────────────────────┐
│                    多用户 WebSocket 架构                             │
└─────────────────────────────────────────────────────────────────────┘

前端（浏览器）                              后端（Express Server）
┌──────────────────┐                      ┌─────────────────────────┐
│  WebSocketClient │                      │  WebSocketServer        │
│  - 连接管理        │◀───────/ws/ws───────▶│  - 连接路由              │
│  - 消息队列        │                      │  - 用户认证              │
│  - 状态机          │                      │  - 容器管理              │
└──────────────────┘                      └───────────┬─────────────┘
                                                       │
                              ┌────────────────────────┼────────────────┐
                              │                        │                │
                              ▼                        ▼                ▼
                       ┌──────────┐            ┌──────────┐     ┌──────────┐
                       │ 用户A容器  │            │ 用户B容器  │     │ 用户C容器  │
                       │ - /ws    │            │ - /ws    │     │ - /ws    │
                       │ - /shell │            │ - /shell │     │ - /shell │
                       └──────────┘            └──────────┘     └──────────┘

WebSocket 连接类型：
1. /ws - 聊天 WebSocket（Claude SDK 通信）
2. /shell - 终端 WebSocket（PTY 通信）
```

#### 5.6.2 后端 WebSocket 管理器

```javascript
/**
 * server/websocket-manager.js
 *
 * WebSocket 连接管理器
 * - 管理多用户 WebSocket 连接
 * - 处理连接状态生命周期
 * - 提供连接池和重连机制
 */

import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import containerManager from './container-manager.js';

// 连接状态枚举
const ConnectionState = {
  CONNECTING: 'connecting',     // 连接中
  AUTHENTICATING: 'authenticating', // 认证中
  AUTHENTICATED: 'authenticated',   // 已认证
  READY: 'ready',                 // 就绪（容器已分配）
  ACTIVE: 'active',               // 活跃（正在执行任务）
  IDLE: 'idle',                   // 空闲
  CLOSING: 'closing',             // 关闭中
  CLOSED: 'closed'                // 已关闭
};

// 连接类型枚举
const ConnectionType = {
  CHAT: 'chat',       // 聊天连接 (/ws)
  SHELL: 'shell'      // 终端连接 (/shell)
};

/**
 * WebSocket 连接类
 */
class WebSocketConnection {
  constructor(ws, userId, connectionType) {
    this.ws = ws;
    this.userId = userId;
    this.connectionType = connectionType;
    this.state = ConnectionState.CONNECTING;
    this.containerId = null;
    this.sessionId = null;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.messageQueue = [];
    this.retryCount = 0;
    this.maxRetries = 3;

    // 绑定事件处理器
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', (code, reason) => this.handleClose(code, reason));
    this.ws.on('error', (error) => this.handleError(error));
    this.ws.on('ping', () => this.handlePing());
  }

  /**
   * 处理消息
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.lastActivity = new Date();

      switch (this.state) {
        case ConnectionState.AUTHENTICATED:
          // 等待容器准备就绪
          await this.waitForContainer(message);
          break;

        case ConnectionState.READY:
        case ConnectionState.IDLE:
          // 处理用户请求
          await this.processRequest(message);
          break;

        case ConnectionState.ACTIVE:
          // 任务执行中，可能需要中止
          if (message.type === 'abort') {
            await this.abortCurrentTask();
          }
          break;

        default:
          this.sendError('Invalid state for message', message.type);
      }
    } catch (error) {
      this.sendError(error.message);
    }
  }

  /**
   * 等待容器准备就绪
   */
  async waitForContainer(message) {
    this.setState(ConnectionState.READY);

    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(
      this.userId,
      { tier: this.userTier }
    );

    this.containerId = container.id;
    this.send({
      type: 'container_ready',
      containerId: this.containerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理用户请求
   */
  async processRequest(message) {
    this.setState(ConnectionState.ACTIVE);

    try {
      // 根据连接类型路由请求
      if (this.connectionType === ConnectionType.CHAT) {
        await this.processChatRequest(message);
      } else if (this.connectionType === ConnectionType.SHELL) {
        await this.processShellRequest(message);
      }

      this.setState(ConnectionState.IDLE);
    } catch (error) {
      this.sendError(error.message);
      this.setState(ConnectionState.IDLE);
    }
  }

  /**
   * 处理聊天请求
   */
  async processChatRequest(message) {
    // 转发到容器内的 Claude SDK
    const result = await containerManager.execInContainer(
      this.userId,
      `claude "${message.command}" --session ${this.sessionId}`,
      {
        cwd: message.projectPath || '/workspace',
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        }
      }
    );

    // 流式转发响应
    result.on('data', (chunk) => {
      this.send({
        type: 'content',
        content: chunk.toString(),
        sessionId: this.sessionId
      });
    });
  }

  /**
   * 处理终端请求
   */
  async processShellRequest(message) {
    // 在容器内创建 PTY 会话
    const pty = await this.createPtyInContainer(message);

    this.send({
      type: 'pty_ready',
      sessionId: this.sessionId
    });
  }

  /**
   * 发送消息
   */
  send(data) {
    if (this.ws.readyState === 1) { // WebSocket.OPEN
      this.ws.send(JSON.stringify(data));
    } else {
      // 连接未就绪，缓存消息
      this.messageQueue.push(data);
    }
  }

  /**
   * 发送错误
   */
  sendError(message, code = null) {
    this.send({
      type: 'error',
      error: message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 设置状态
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    // 触发状态变更事件
    this.onStateChange(oldState, newState);
  }

  /**
   * 状态变更处理
   */
  onStateChange(oldState, newState) {
    console.log(`[WS] User ${this.userId}: ${oldState} -> ${newState}`);

    // 发送状态变更通知
    this.send({
      type: 'state_change',
      oldState,
      newState,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理关闭
   */
  handleClose(code, reason) {
    this.setState(ConnectionState.CLOSED);
    console.log(`[WS] User ${this.userId} connection closed:`, code, reason);
  }

  /**
   * 处理错误
   */
  handleError(error) {
    console.error(`[WS] User ${this.userId} connection error:`, error);
    this.sendError(error.message);
  }

  /**
   * 处理 ping
   */
  handlePing() {
    this.ws.pong();
  }

  /**
   * 关闭连接
   */
  close(code, reason) {
    this.setState(ConnectionState.CLOSING);
    this.ws.close(code, reason);
  }
}

/**
 * WebSocket 管理器类
 */
class WebSocketManager {
  constructor(server) {
    // 连接池：userId -> WebSocketConnection
    this.connections = new Map();

    // 按类型分组：connectionType -> Set<userId>
    this.connectionsByType = new Map();

    // 创建 WebSocket 服务器
    this.wss = new WebSocketServer({
      server,
      verifyClient: async (info, callback) => {
        await this.verifyClient(info, callback);
      }
    });

    // 连接处理
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
  }

  /**
   * 验证客户端
   */
  async verifyClient(info, callback) {
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token') ||
                 info.req.headers.authorization?.split(' ')[1];

    try {
      // 验证 JWT Token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      info.req.user = decoded;
      callback(true);
    } catch (error) {
      console.error('[WS] Authentication failed:', error.message);
      callback(false, 401, 'Unauthorized');
    }
  }

  /**
   * 处理新连接
   */
  handleConnection(ws, request) {
    const url = new URL(request.url, 'http://localhost');
    const userId = request.user.id;
    const pathname = url.pathname;

    // 确定连接类型
    let connectionType;
    if (pathname === '/ws') {
      connectionType = ConnectionType.CHAT;
    } else if (pathname === '/shell') {
      connectionType = ConnectionType.SHELL;
    } else {
      ws.close(1000, 'Invalid WebSocket path');
      return;
    }

    // 创建连接对象
    const connection = new WebSocketConnection(ws, userId, connectionType);

    // 存储连接
    this.connections.set(userId, connection);

    // 按类型分组
    if (!this.connectionsByType.has(connectionType)) {
      this.connectionsByType.set(connectionType, new Set());
    }
    this.connectionsByType.get(connectionType).add(userId);

    console.log(`[WS] User ${userId} connected (${connectionType})`);
  }

  /**
   * 获取用户连接
   */
  getConnection(userId) {
    return this.connections.get(userId);
  }

  /**
   * 广播消息到指定类型的所有连接
   */
  broadcast(connectionType, message) {
    const userIds = this.connectionsByType.get(connectionType) || new Set();

    userIds.forEach(userId => {
      const connection = this.connections.get(userId);
      if (connection && connection.ws.readyState === 1) {
        connection.send(message);
      }
    });
  }

  /**
   * 关闭用户连接
   */
  closeConnection(userId, code, reason) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.close(code, reason);
      this.connections.delete(userId);

      // 从类型分组中移除
      this.connectionsByType.forEach((users, type) => {
        users.delete(userId);
      });
    }
  }

  /**
   * 获取连接统计
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      chatConnections: this.connectionsByType.get(ConnectionType.CHAT)?.size || 0,
      shellConnections: this.connectionsByType.get(ConnectionType.SHELL)?.size || 0
    };
  }
}

export default WebSocketManager;
export { ConnectionState, ConnectionType };
```

#### 5.6.3 前端 WebSocket 状态机

```javascript
/**
 * src/contexts/WebSocketStateMachine.jsx
 *
 * 前端 WebSocket 状态机
 * - 管理连接状态
 * - 处理消息队列
 * - 提供重连机制
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

// 状态枚举（与后端一致）
const ConnectionState = {
  DISCONNECTED: 'disconnected',     // 未连接
  CONNECTING: 'connecting',         // 连接中
  AUTHENTICATING: 'authenticating', // 认证中
  AUTHENTICATED: 'authenticated',   // 已认证
  READY: 'ready',                   // 就绪
  ACTIVE: 'active',                 // 活跃
  IDLE: 'idle',                     // 空闲
  CLOSING: 'closing',               // 关闭中
  ERROR: 'error'                    // 错误
};

// WebSocket 上下文
const WebSocketContext = createContext(null);

/**
 * WebSocket 状态机 Provider
 */
export function WebSocketProvider({ children, token }) {
  const [state, setState] = useState(ConnectionState.DISCONNECTED);
  const [ws, setWs] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [containerReady, setContainerReady] = useState(false);

  const messageQueue = useRef([]);
  const retryCount = useRef(0);
  const maxRetries = 5;
  const retryDelay = 1000; // 1秒
  const reconnectTimeout = useRef(null);

  /**
   * 状态转换
   */
  const transitionTo = useCallback((newState) => {
    setState(prevState => {
      console.log(`[WS] State transition: ${prevState} -> ${newState}`);
      return newState;
    });
  }, []);

  /**
   * 连接 WebSocket
   */
  const connect = useCallback((connectionType = 'ws') => {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    transitionTo(ConnectionState.CONNECTING);

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/${connectionType}?token=${token}`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log('[WS] Connected');
      transitionTo(ConnectionState.AUTHENTICATING);
      retryCount.current = 0;
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('[WS] Message parse error:', error);
      }
    };

    newWs.onerror = (error) => {
      console.error('[WS] Error:', error);
      transitionTo(ConnectionState.ERROR);
    };

    newWs.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      transitionTo(ConnectionState.DISCONNECTED);
      setContainerReady(false);

      // 自动重连
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        const delay = retryDelay * Math.pow(2, retryCount.current - 1);
        console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${retryCount.current}/${maxRetries})`);

        reconnectTimeout.current = setTimeout(() => {
          connect(connectionType);
        }, delay);
      }
    };

    setWs(newWs);
  }, [token, ws, transitionTo]);

  /**
   * 处理 WebSocket 消息
   */
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'state_change':
        // 处理状态变更
        transitionTo(data.newState);
        break;

      case 'container_ready':
        // 容器准备就绪
        setContainerReady(true);
        transitionTo(ConnectionState.READY);

        // 发送队列中的消息
        flushMessageQueue();
        break;

      case 'content':
      case 'output':
        // 普通消息，由上层处理
        break;

      case 'error':
        console.error('[WS] Server error:', data.error);
        transitionTo(ConnectionState.ERROR);
        break;

      case 'session-aborted':
        // 会话中止
        transitionTo(ConnectionState.IDLE);
        break;

      default:
        // 其他消息类型
        break;
    }
  }, [transitionTo]);

  /**
   * 刷新消息队列
   */
  const flushMessageQueue = useCallback(() => {
    while (messageQueue.current.length > 0) {
      const message = messageQueue.current.shift();
      send(message);
    }
  }, []);

  /**
   * 发送消息
   */
  const send = useCallback((message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (state === ConnectionState.READY || state === ConnectionState.IDLE) {
        ws.send(JSON.stringify(message));
        transitionTo(ConnectionState.ACTIVE);
      } else if (state === ConnectionState.CONNECTING || state === ConnectionState.AUTHENTICATING) {
        // 连接未就绪，加入队列
        messageQueue.current.push(message);
      }
    } else {
      console.warn('[WS] Cannot send message: WebSocket not connected');
    }
  }, [ws, state, transitionTo]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (ws) {
      ws.close(1000, 'User disconnect');
    }
    transitionTo(ConnectionState.DISCONNECTED);
  }, [ws, transitionTo]);

  /**
   * 清理
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = {
    state,
    containerReady,
    sessionId,
    connect,
    disconnect,
    send,
    isConnected: state !== ConnectionState.DISCONNECTED && state !== ConnectionState.ERROR
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * 使用 WebSocket Hook
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
```

#### 5.6.4 WebSocket 状态转换图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WebSocket 状态机                                  │
└─────────────────────────────────────────────────────────────────────────┘

前端状态转换：
┌─────────────┐
│ DISCONNECTED│ ◀────────────────────────────────────────────────────────┐
└──────┬──────┘                                                           │
       │ connect()                                                         │
       ▼                                                                  │
┌─────────────┐    onopen    ┌─────────────────┐                         │
│ CONNECTING  │─────────────▶│ AUTHENTICATING  │                         │
└─────────────┘              └─────────┬───────┘                                         │
                                      │ authenticated                              │
                                      ▼                                            │
                             ┌─────────────────┐                                  │
                             │ AUTHENTICATED   │                                  │
                             └─────────┬───────┘                                  │
                                       │ container_ready                           │
                                       ▼                                            │
                             ┌─────────────────┐    send()    ┌──────────┐        │
                             │     READY       │─────────────▶│  ACTIVE  │        │
                             └─────────┬───────┘              └─────┬────┘        │
                                       │                            │             │
                                       │ response                  │             │
                                       ▼                            │             │
                             ┌─────────────────┐◀───────────────────┘             │
                             │      IDLE       │◀─────────────────────────────────┤
                             └─────────────────┘    error/close                   │
                                       │                                            │
                                       │ close()                                   │
                                       ▼                                            │
                                ┌─────────────┐                                   │
                                │   CLOSING   │                                   │
                                └──────┬──────┘                                   │
                                       │                                            │
                                       ▼                                            │
                                ┌─────────────┐                                   │
                                │  CLOSED     │───────────────────────────────────┤
                                └─────────────┘                                   │
                                                                               │
后端状态转换：                                                                 │
┌─────────────┐                                                              │
│  CONNECTING │◀────────────────────────────────────────────────────────────┘
└──────┬──────┘
       │ connection accepted
       ▼
┌─────────────────┐    auth success    ┌─────────────────┐
│ AUTHENTICATING  │───────────────────▶│ AUTHENTICATED   │
└─────────────────┘                    └─────────┬───────┘
                                               │ container allocated
                                               ▼
                                        ┌─────────────────┐
                                        │      READY      │
                                        └─────────┬───────┘
                                                  │ request received
                                                  ▼
                                        ┌─────────────────┐
                                        │     ACTIVE      │
                                        └─────────┬───────┘
                                                  │ task completed
                                                  ▼
                                        ┌─────────────────┐
                                        │      IDLE       │
                                        └─────────────────┘
                                                  │ close/error
                                                  ▼
                                        ┌─────────────────┐
                                        │    CLOSING      │
                                        └─────────┬───────┘
                                                  │
                                                  ▼
                                        ┌─────────────────┐
                                        │    CLOSED       │
                                        └─────────────────┘
```

#### 5.6.5 多用户并发连接处理

```javascript
/**
 * 并发连接处理示例
 *
 * 场景：3个用户同时使用系统
 * - 用户A：正在执行 Claude 命令
 * - 用户B：正在使用终端
 * - 用户C：刚刚连接，等待容器准备
 */

const concurrentConnectionsExample = {
  // 用户A - 聊天连接活跃
  'user_1': {
    connectionType: 'chat',
    state: 'active',
    containerId: 'claude-user-1-container',
    sessionId: 'sess_abc123',
    currentTask: 'claude "帮我重构这个组件"',
    startedAt: '2026-01-10T10:30:00Z'
  },

  // 用户B - 终端连接活跃
  'user_2': {
    connectionType: 'shell',
    state: 'active',
    containerId: 'claude-user-2-container',
    sessionId: 'pty_xyz789',
    currentTask: 'running tests',
    startedAt: '2026-01-10T10:28:00Z'
  },

  // 用户C - 刚连接，等待容器
  'user_3': {
    connectionType: 'chat',
    state: 'authenticated',
    containerId: null,
    sessionId: null,
    currentTask: 'waiting for container',
    startedAt: '2026-01-10T10:35:00Z'
  }
};

// 资源隔离保证：
// 1. 用户A、B、C的容器完全独立
// 2. 用户A的命令不影响用户B的终端
// 3. 用户C等待容器时，A和B可以正常工作
// 4. 每个用户的WebSocket连接独立管理
```

#### 5.6.6 连接池管理策略

```javascript
/**
 * 连接池配置
 */
const ConnectionPoolConfig = {
  // 最大并发连接数
  maxConnections: 100,

  // 每个用户最大连接数
  maxConnectionsPerUser: 2,

  // 连接超时时间
  connectionTimeout: 30000, // 30秒

  // 空闲连接清理时间
  idleTimeout: 300000, // 5分钟

  // 心跳间隔
  heartbeatInterval: 30000, // 30秒

  // 重连策略
  retry: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  }
};
```

---

## 六、安全策略配置

### 6.1 Seccomp 策略

#### 6.1.1 默认 Seccomp 配置

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_X32"
  ],
  "syscalls": [
    {
      "name": "access",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "arch_prctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "brk",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "capget",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "capset",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chmod",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chown",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "clone",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "close",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "connect",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "creat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup2",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup3",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create1",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_ctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_pwait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_wait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "execve",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "exit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "exit_group",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "faccessat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fadvise64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchmod",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchmodat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchown",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchownat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fcntl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstatfs",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fsync",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ftruncate",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "futex",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getcwd",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getdents",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getdents64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getegid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "geteuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgroups",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpeername",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getppid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getrlimit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsockname",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsockopt",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "gettid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ioctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "lseek",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "lstat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "madvise",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mkdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mkdirat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mknod",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mmap",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mprotect",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "munmap",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "nanosleep",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "newfstatat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "open",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "openat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pipe",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pipe2",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "poll",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ppoll",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pread64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "prctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "preadv",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pwrite64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pwritev",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "read",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "readlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "readlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "recvfrom",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "recvmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rename",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "renameat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rmdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigaction",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigprocmask",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigreturn",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_getaffinity",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_yield",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sendmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sendto",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setsockopt",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "set_tid_address",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sigaltstack",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "socket",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "socketpair",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "stat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "statfs",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "symlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "symlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "tgkill",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "time",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "tkill",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "uname",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "unlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "unlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "utimensat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "wait4",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "waitpid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "write",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "writev",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "exit_group",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "set_robust_list",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "get_robust_list",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getrandom",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "memfd_create",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "clock_gettime",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "clock_getres",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstatat64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "stat64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "lstat64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstat64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getdents64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ugetrlimit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setrlimit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getrlimit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "poll",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigtimedwait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sigreturn",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "accept4",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "recvmmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sendmmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsockname",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpeername",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsockopt",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setsockopt",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsockname",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "socketpair",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "gettid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getcpu",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "gettimeofday",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "times",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getrusage",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getsid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setpgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getppid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getegid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setegid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "geteuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "seteuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgroups",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setgroups",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getresuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setresuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getresgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setresgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getitimer",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setitimer",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_getparam",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_setparam",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_getscheduler",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_setscheduler",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_get_priority_max",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_get_priority_min",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sched_rr_get_interval",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "set_tid_address",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "restart_syscall",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "seccomp",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "signalfd",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "signalfd4",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "eventfd",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "eventfd2",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create1",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_ctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_wait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_pwait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "inotify_init",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "inotify_init1",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "inotify_add_watch",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "inotify_rm_watch",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "futex",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getppid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "set_tid_address",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setns",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "unshare",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "mount",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "pivot_root",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "ptrace",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "kexec_load",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "init_module",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "finit_module",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "delete_module",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "acct",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "swapon",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "swapoff",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "sysctl",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "syslog",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "sethostname",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "setdomainname",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "vhangup",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "reboot",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "settimeofday",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "stime",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "clock_settime",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "adjtimex",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "lookup_dcookie",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "perf_event_open",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "fanotify_init",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "fanotify_mark",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "process_vm_readv",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "process_vm_writev",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "name_to_handle_at",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "open_by_handle_at",
      "action": "SCMP_ACT_ERRNO"
    },
    {
      "name": "userfaultfd",
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
```

### 6.2 AppArmor 配置

```apparmor
# /etc/apparmor.d/docker-default
#include <tunables/global>

profile docker-default flags=(attach_disconnected,mediate_deleted) {
  # 包含基础权限
  #include <abstractions/base>
  #include <abstractions/namespaces>

  # 允许基本文件操作
  capability,
  dac_override,
  dac_read_search,
  fowner,
  fsetid,
  kill,
  setgid,
  setuid,
  setfcap,
  setpcap,
  net_bind_service,
  net_raw,
  sys_chroot,
  mknod,

  # 允许 /workspace 目录操作
  /workspace/** rw,
  /tmp/** rw,
  /home/claude/** rw,

  # 允许读取系统库
  /usr/lib/** r,
  /lib/** r,
  /etc/ld.so.cache r,
  /etc/ld.so.preload r,

  # 允许网络访问
  network inet stream,
  network inet dgram,

  # 拒绝危险操作
  deny /proc/sys/** w,
  deny /sys/** w,
  deny /proc/kcore rw,
  deny /proc/kallsyms rw,
  deny /proc/mem rw,

  # 允许进程操作
  ptrace (read,trace) peer=unconfined,
  signal (receive) peer=unconfined,

  # 允许特定的 Unix socket
  unix (send, receive) type=stream addr=none,

  # 拒绝访问 Docker socket
  deny /var/run/docker.sock rw,
}
```

### 6.3 网络隔离配置

```javascript
// 创建用户隔离网络
const createUserIsolatedNetwork = async (userId) => {
  const networkName = `claude-user-${userId}`;

  await docker.createNetwork({
    Name: networkName,
    Driver: 'bridge',
    Internal: false,  // 允许访问外网（用于 API 调用）
    IPAM: {
      Driver: 'default',
      Config: [{
        Subnet: `172.${(userId % 254) + 1}.0.0/16`,
        IPRange: `172.${(userId % 254) + 1}.1.0/24`,
        Gateway: `172.${(userId % 254) + 1}.0.1`
      }]
    },
    Options: {
      'com.docker.network.bridge.name': `br-claude-${userId}`,
      'com.docker.network.bridge.enable_icc': 'false',  // 容器间隔离
      'com.docker.network.bridge.enable_ip_masquerade': 'true'
    },
    Labels: {
      'com.claude-code.user': String(userId),
      'com.claude-code.managed': 'true'
    }
  });

  return networkName;
};
```

### 6.4 资源限制配置

```javascript
// 用户等级资源配额
const USER_TIER_LIMITS = {
  free: {
    // CPU
    cpuQuota: 50000,        // 0.5 CPU
    cpuPeriod: 100000,
    cpuShares: 512,

    // 内存
    memory: 1 * 1024 * 1024 * 1024,     // 1GB
    memoryReservation: 512 * 1024 * 1024, // 512MB
    memorySwap: 2 * 1024 * 1024 * 1024,   // 2GB (含 swap)

    // 磁盘
    diskQuota: 5 * 1024 * 1024 * 1024,   // 5GB

    // 进程
    pidsLimit: 100,

    // 超时
    timeout: 5 * 60 * 1000,  // 5分钟

    // 网络
    networkPriority: 0
  },

  pro: {
    cpuQuota: 200000,       // 2 CPU
    cpuPeriod: 100000,
    cpuShares: 2048,

    memory: 4 * 1024 * 1024 * 1024,
    memoryReservation: 2 * 1024 * 1024 * 1024,
    memorySwap: 8 * 1024 * 1024 * 1024,

    diskQuota: 20 * 1024 * 1024 * 1024,
    pidsLimit: 500,
    timeout: 60 * 60 * 1000,  // 1小时
    networkPriority: 1
  },

  enterprise: {
    cpuQuota: 400000,       // 4 CPU
    cpuPeriod: 100000,
    cpuShares: 4096,

    memory: 8 * 1024 * 1024 * 1024,
    memoryReservation: 4 * 1024 * 1024 * 1024,
    memorySwap: 16 * 1024 * 1024 * 1024,

    diskQuota: 50 * 1024 * 1024 * 1024,
    pidsLimit: 1000,
    timeout: 2 * 60 * 60 * 1000,  // 2小时
    networkPriority: 2
  }
};
```

---

## 七、部署架构

### 7.1 单服务器部署

```
┌─────────────────────────────────────────────────────────┐
│                    单服务器部署架构                       │
└─────────────────────────────────────────────────────────┘

服务器配置:
- CPU: 8 核
- 内存: 32GB
- 磁盘: 500GB SSD
- 网络: 1Gbps

部署组件:
├── Nginx (反向代理)
│   ├── SSL 终止
│   ├── 负载均衡
│   └── 静态文件服务
│
├── Claude Code 主应用
│   ├── Express HTTP 服务器
│   ├── WebSocket 服务器
│   └── SQLite 数据库
│
├── Docker
│   ├── Docker Daemon
│   ├── 容器运行时
│   └── 容器网络
│
└── 监控组件
    ├── Prometheus (指标收集)
    ├── Grafana (可视化)
    └── Loki (日志聚合)

用户容量估算:
- Free 用户: ~30-50 并发用户 (0.5核 + 1GB)
- Pro 用户: ~15-25 并发用户 (1核 + 2GB)
- Enterprise 用户: ~8-12 并发用户 (2核 + 4GB)
```

### 7.2 Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    ports:
      - "3001:3001"
    volumes:
      - ./workspace:/app/workspace              # 持久化数据目录（与代码分离）
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DOCKER_HOST=unix:///var/run/docker.sock
      - WORKSPACE_DIR=/app/workspace             # 指定工作目录环境变量
    restart: unless-stopped
    depends_on:
      - db
    networks:
      - claude-network

  db:
    image: postgres:15-alpine
    volumes:
      - ./workspace/database:/var/lib/postgresql/data  # 数据库数据也放在 ./workspace 下
    environment:
      - POSTGRES_DB=claude_code
      - POSTGRES_USER=claude
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped
    networks:
      - claude-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./workspace/ssl:/etc/nginx/ssl:ro       # SSL 证书放在 ./workspace 下
      - ./dist:/usr/share/nginx/html:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - claude-network

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./workspace/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./workspace/prometheus:/prometheus       # Prometheus 数据放在 ./workspace 下
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - claude-network

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./workspace/grafana:/var/lib/grafana    # Grafana 数据放在 ./workspace 下
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    restart: unless-stopped
    networks:
      - claude-network

networks:
  claude-network:
    driver: bridge
```

### 7.3 生产环境部署清单

```yaml
# production-config.yml
environment:
  NODE_ENV: production
  PORT: 3001

# 数据库配置
database:
  type: postgresql
  host: localhost
  port: 5432
  name: claude_code
  user: claude
  password: ${DB_PASSWORD}
  ssl: true

# Docker 配置
docker:
  socketPath: /var/run/docker.sock
  apiVersion: 1.43

# 容器配置
containers:
  image: claude-code-runtime:latest
  dataDir: ./workspace                       # 使用项目根目录下的 ./workspace 目录
  logLevel: info

# 资源限制
resources:
  defaultTier: free
  tiers:
    free:
      cpu: 0.5
      memory: 1G
      disk: 5G
    pro:
      cpu: 2
      memory: 4G
      disk: 20G
    enterprise:
      cpu: 4
      memory: 8G
      disk: 50G

# 安全配置
security:
  seccompProfile: /etc/seccomp/claude-code.json
  apparmorProfile: docker-default
  enableNetworkIsolation: true
  allowPrivileged: false

# 监控配置
monitoring:
  enabled: true
  prometheusUrl: http://localhost:9090
  grafanaUrl: http://localhost:3000

# 日志配置
logging:
  level: info
  format: json
  output:
    - type: file
      path: /var/log/claude-code-ui/app.log
    - type: syslog
      facility: local0
```

---

## 八、实施计划

### 8.1 分阶段实施路线

```
┌─────────────────────────────────────────────────────────┐
│                    实施路线图                             │
└─────────────────────────────────────────────────────────┘

阶段 1: 基础设施准备 (1-2 周)
├── 宿主机环境配置
│   ├── 安装 Docker 24.x
│   ├── 配置 Docker Daemon
│   ├── 配置 Seccomp 策略
│   └── 配置 AppArmor 配置
├── 构建容器镜像
│   ├── 编写 Dockerfile
│   ├── 测试容器镜像
│   └── 推送到镜像仓库
└── 数据库准备
    ├── 扩展数据库表结构
    └── 数据迁移脚本

阶段 2: 核心功能开发 (2-3 周)
├── 容器管理器开发
│   ├── ContainerManager 类
│   ├── 容器生命周期管理
│   ├── 资源限制配置
│   └── 容器池管理
├── Claude SDK 容器化
│   ├── 改造 claude-sdk.js
│   ├── 容器内执行逻辑
│   └── 流式输出处理
└── PTY 容器化
    ├── 改造 shell 连接处理
    ├── 容器内 PTY 创建
    └── 会话管理

阶段 3: 文件操作容器化 (1-2 周)
├── 文件读取改造
├── 文件保存改造
├── 文件树获取改造
└── 路径安全验证

阶段 4: 安全加固 (1 周)
├── Seccomp 策略优化
├── AppArmor 配置
├── 网络隔离配置
└── 资源限制调优

阶段 5: 测试与优化 (1-2 周)
├── 功能测试
│   ├── 单用户测试
│   ├── 多用户并发测试
│   └── 容器隔离测试
├── 性能测试
│   ├── 容器启动时间
│   ├── 执行性能
│   └── 资源使用
└── 安全测试
    ├── 容器逃逸测试
    ├── 资源限制测试
    └── 网络隔离测试

阶段 6: 部署与监控 (1 周)
├── 生产环境部署
├── 监控系统搭建
├── 日志聚合配置
└── 告警规则配置

总计: 7-11 周
```

### 8.2 关键里程碑

| 里程碑 | 交付物 | 验收标准 |
|--------|--------|---------|
| M1: 基础设施就绪 | Docker 环境配置完成 | 可在宿主机上运行容器 |
| M2: 容器管理器完成 | ContainerManager 模块 | 可通过 API 创建/销毁容器 |
| M3: SDK 容器化完成 | Claude SDK 容器化版本 | 可在容器内执行 Claude 命令 |
| M4: PTY 容器化完成 | PTY 容器化版本 | 可在容器内创建终端会话 |
| M5: 文件操作完成 | 文件操作容器化版本 | 可通过容器读写文件 |
| M6: 安全加固完成 | 安全策略配置 | 通过安全测试 |
| M7: 生产部署完成 | 生产环境运行 | 多用户可正常使用 |

### 8.3 风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Docker API 兼容性问题 | 中 | 中 | 使用稳定版本的 Docker，进行充分测试 |
| 容器性能开销 | 高 | 中 | 进行性能基准测试，优化资源分配 |
| 容器逃逸漏洞 | 低 | 高 | 定期更新 Docker，使用 Seccomp/AppArmor |
| 存储卷管理复杂 | 中 | 中 | 使用 Docker Volume，编写管理脚本 |
| 网络配置问题 | 中 | 低 | 简化网络配置，使用默认 bridge 网络 |
| 资源限制失效 | 中 | 中 | 使用 cgroups v2，监控资源使用 |

### 8.4 回滚计划

```
如果容器化方案出现问题，可以按以下步骤回滚：

1. 停止创建新容器
   - 禁用 ContainerManager
   - 切换到直接执行模式

2. 迁移现有用户
   - 从容器卷导出用户数据
   - 恢复到宿主机目录

3. 恢复原有代码
   - 切换到容器化前的代码分支
   - 重启应用服务

4. 清理容器资源
   - 停止并删除所有用户容器
   - 删除用户网络
   - 删除 Docker Volume

预计回滚时间: 2-4 小时
```

### 8.5 成功标准

```
功能指标:
✓ 每个用户拥有独立的容器环境
✓ 容器间完全隔离，无法互相访问
✓ Claude SDK 可在容器内正常运行
✓ 终端 (PTY) 可在容器内正常工作
✓ 文件操作通过容器进行
✓ 容器资源限制生效

性能指标:
✓ 容器启动时间 < 5 秒
✓ 命令执行延迟增加 < 20%
✓ 内存开销增加 < 10%
✓ 支持至少 20 个并发用户

安全指标:
✓ 通过 Seccomp 策略限制危险系统调用
✓ 通过 AppArmor 限制文件访问
✓ 容器无法访问宿主机 Docker Socket
✓ 容器网络隔离生效
✓ 资源限制防止资源滥用

可靠性指标:
✓ 容器故障不影响其他用户
✓ 容器可自动重启恢复
✓ 用户数据持久化正常
✓ 日志完整可追踪
```

---

## 九、附录

### 9.1 相关文档

- [多用户沙箱隔离方案评估报告](./multi-user-sandbox-evaluation.md)
- [项目结构说明](./ai-context/project-structure.md)
- [API 文档](./api/README.md)

### 9.2 参考资源

#### Docker 官方文档
- [Docker API Reference](https://docs.docker.com/engine/api/latest/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Docker Seccomp](https://docs.docker.com/engine/security/seccomp/)

#### Node.js Docker 库
- [Dockerode Documentation](https://github.com/apocas/dockerode)
- [Dockerode Examples](https://github.com/apocas/dockerode/tree/master/examples)

#### 安全最佳实践
- [Docker Security Best Practices](https://snyk.io/blog/10-docker-image-security-best-practices/)
- [Container Security Checklist](https://github.com/konstruktoid/Security)

### 9.3 术语表

| 术语 | 说明 |
|------|------|
| **Container** | Docker 容器，轻量级虚拟化技术 |
| **Seccomp** | Linux 系统调用过滤机制 |
| **AppArmor** | Linux 强制访问控制系统 |
| **Volume** | Docker 数据卷，用于数据持久化 |
| **PTY** | 伪终端，用于终端模拟 |
| **cgroups** | Linux 控制组，用于资源限制 |
| **namespace** | Linux 命名空间，用于资源隔离 |
| **Dockerode** | Node.js 的 Docker API 客户端库 |

---

**文档维护**

本文档应该根据实际实施情况持续更新。如有任何疑问或建议，请联系项目维护者。

**版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-10 | Claude | 初始版本 |

---

**END OF DOCUMENT**
