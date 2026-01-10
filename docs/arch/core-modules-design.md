# 多用户 Claude Code 系统 - 核心模块设计

> **文档版本**: 1.0
> **创建时间**: 2026-01-10
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、核心实现流程](#一核心实现流程)
- [二、模块详细设计](#二模块详细设计)

---

## 一、核心实现流程

### 1.1 用户认证与容器初始化流程

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

### 1.2 Claude SDK 容器执行流程

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

### 1.3 终端 (PTY) 容器执行流程

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
│ 3. 双向数据流传输                                          │
│    - 前端 -> WebSocket -> 容器 PTY                         │
│    - 容器 PTY -> WebSocket -> 前端                         │
│    - 实时同步终端输出                                      │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 4. 会话管理                                                │
│    - 监控会话状态                                          │
│    - 处理会话超时                                          │
│    - 清理僵尸会话                                          │
└───────────────────────────────────────────────────────────┘
```

### 1.4 文件操作容器化流程

```
┌─────────────┐
│ 前端请求文件  │
│ 操作         │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│ 1. 路径安全验证                                            │
│    - 验证路径格式                                          │
│    - 防止路径遍历攻击                                       │
│    - 限制在 /workspace 目录内                              │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 2. 容器内文件操作                                          │
│    - 读取: docker exec cat /workspace/path/to/file        │
│    - 写入: docker exec sh -c 'echo "content" > file'      │
│    - 列表: docker exec ls -la /workspace/path             │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ 3. 结果返回                                                │
│    - 返回文件内容                                          │
│    - 返回操作结果                                          │
│    - 错误处理                                              │
└───────────────────────────────────────────────────────────┘
```

### 1.5 容器生命周期管理流程

```
┌───────────────────────────────────────────────────────────┐
│                    容器状态转换图                           │
└───────────────────────────────────────────────────────────┘

[不存在]
   │
   │ getOrCreateContainer()
   ▼
[创建中] (creating)
   │
   │ docker create + start
   ▼
[运行中] (running) ◄────┐
   │                    │
   │                    │ exec / attach
   │                    │
   │ stop()             │
   ▼                    │
[已停止] (stopped)        │
   │                    │
   │ start()            │
   ▼                    │
[运行中] (running) ──────┘
   │
   │ remove()
   ▼
[删除中] (removing)
   │
   │
   ▼
[已删除] (removed)
```

**容器状态说明**：
- `creating`: 容器正在创建
- `running`: 容器运行中
- `stopped`: 容器已停止
- `removing`: 容器正在删除
- `removed`: 容器已删除

---

## 二、模块详细设计

### 2.1 容器管理器 (ContainerManager)

#### 2.1.1 模块结构

```javascript
/**
 * server/services/container/ContainerManager.js
 *
 * 容器生命周期管理模块
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';

class ContainerManager {
  constructor(options = {}) {
    this.docker = new Docker({
      socketPath: options.socketPath || '/var/run/docker.sock'
    });

    // 容器池缓存
    this.containers = new Map();  // userId -> containerInfo

    // 配置
    this.config = {
      dataDir: options.dataDir,
      image: options.image || 'claude-code-runtime:latest',
      network: options.network || 'bridge',
      ...options
    };

    // 启动清理定时器
    this.startCleanupInterval();
  }

  /**
   * 获取或创建用户容器
   * @param {number} userId - 用户 ID
   * @param {object} userConfig - 用户配置
   * @returns {Promise<ContainerInfo>}
   */
  async getOrCreateContainer(userId, userConfig = {}) {
    // 检查缓存
    if (this.containers.has(userId)) {
      const container = this.containers.get(userId);
      const status = await this.getContainerStatus(container.id);

      if (status === 'running') {
        container.lastActive = new Date();
        return container;
      }

      // 容器未运行，清理
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

    // 2. 创建容器配置
    const containerConfig = this.buildContainerConfig({
      name: containerName,
      volumeName,
      userId,
      userConfig
    });

    // 3. 创建并启动容器
    const container = await this.docker.createContainer(containerConfig);
    await container.start();

    // 4. 等待容器就绪
    await this.waitForContainerReady(container.id);

    // 5. 缓存容器信息
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
    const { name, volumeName, userId, userConfig } = options;
    const resourceLimits = this.getResourceLimits(userConfig.tier || 'free');

    return {
      name: name,
      Image: this.config.image,
      Env: [
        `USER_ID=${userId}`,
        `NODE_ENV=production`
      ],
      HostConfig: {
        Binds: [
          `${volumeName}:/workspace:rw`
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        SecurityOpt: resourceLimits.securityOptions
      },
      Labels: {
        'com.claude-code.user': String(userId),
        'com.claude-code.managed': 'true'
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
          'seccomp=claude-code-default.json'
        ]
      },
      pro: {
        memory: 4 * 1024 * 1024 * 1024,  // 4GB
        cpuQuota: 200000,                 // 2 CPU
        cpuPeriod: 100000,
        securityOptions: [
          'seccomp=claude-code-default.json'
        ]
      }
    };

    return limits[tier] || limits.free;
  }

  /**
   * 在容器内执行命令
   * @param {number} userId - 用户 ID
   * @param {string} command - 要执行的命令
   * @returns {Promise<object>} 执行结果
   */
  async execInContainer(userId, command) {
    const container = await this.getOrCreateContainer(userId);
    const exec = await this.docker.getContainer(container.id).exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace'
    });

    return await exec.start({ Detach: false });
  }

  /**
   * 销毁用户容器
   * @param {number} userId - 用户 ID
   */
  async destroyContainer(userId, removeVolume = false) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    const container = this.docker.getContainer(containerInfo.id);

    // 停止容器
    await container.stop({ t: 10 });

    // 删除容器
    await container.remove();

    // 从缓存中移除
    this.containers.delete(userId);

    // 可选：删除卷
    if (removeVolume) {
      const volume = this.docker.getVolume(`claude-user-${userId}`);
      await volume.remove();
    }
  }

  /**
   * 清理空闲容器
   */
  async cleanupIdleContainers() {
    const idleTimeout = 30 * 60 * 1000; // 30 分钟
    const now = Date.now();

    for (const [userId, container] of this.containers) {
      const idleTime = now - container.lastActive.getTime();

      if (idleTime > idleTimeout) {
        console.log(`Cleaning up idle container for user ${userId}`);
        await this.destroyContainer(userId, false);
      }
    }
  }

  /**
   * 启动清理定时器
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupIdleContainers().catch(err => {
        console.error('Cleanup error:', err);
      });
    }, 5 * 60 * 1000); // 每 5 分钟检查一次
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
      if (info.State.Status === 'running') {
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
      if (error.statusCode === 409) {
        // Volume 已存在
        return;
      }
      throw error;
    }
  }
}

export default ContainerManager;
```

#### 2.1.2 使用示例

```javascript
import ContainerManager from './services/container/ContainerManager.js';

// 创建容器管理器实例
const containerManager = new ContainerManager({
  dataDir: './workspace',
  image: 'claude-code-runtime:latest'
});

// 获取或创建用户容器
const container = await containerManager.getOrCreateContainer(1, {
  tier: 'free'
});

// 在容器内执行命令
const result = await containerManager.execInContainer(1, 'ls -la');

// 销毁用户容器
await containerManager.destroyContainer(1);
```

### 2.2 容器镜像设计 (Dockerfile)

```dockerfile
# Dockerfile for Claude Code Runtime
FROM node:20-alpine

# 安装系统依赖
RUN apk add --no-cache \
    git \
    openssh-client \
    python3 \
    make \
    g++

# 创建工作目录
WORKDIR /workspace

# 复制 Claude SDK
COPY claude-sdk.js /usr/local/lib/claude-sdk.js

# 复制 PTY 包装器
COPY pty-wrapper.js /usr/local/lib/pty-wrapper.js

# 设置环境变量
ENV NODE_ENV=production \
    PATH="/usr/local/bin:${PATH}"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# 设置入口点
ENTRYPOINT ["node", "-e", "process.exit(0)"]

# 默认命令
CMD ["sh"]
```

### 2.3 WebSocket 连接管理

#### 2.3.1 多用户 WebSocket 架构

```javascript
/**
 * server/websocket-manager.js
 *
 * WebSocket 连接管理器
 */

import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import ContainerManager from './services/container/ContainerManager.js';

class WebSocketManager {
  constructor() {
    this.clients = new Map();  // ws -> { userId, containerId, ... }
    this.containerManager = new ContainerManager();
  }

  /**
   * 处理 WebSocket 连接
   */
  handleConnection(ws, req) {
    // 1. 验证 JWT Token
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2. 获取用户容器
    this.containerManager.getOrCreateContainer(decoded.userId)
      .then(container => {
        // 3. 注册客户端
        this.clients.set(ws, {
          userId: decoded.userId,
          containerId: container.id,
          isAlive: true
        });

        // 4. 处理消息
        ws.on('message', (message) => this.handleMessage(ws, message));

        // 5. 处理断开
        ws.on('close', () => this.handleDisconnect(ws));

        // 6. 发送就绪消息
        ws.send(JSON.stringify({
          type: 'ready',
          containerId: container.id
        }));
      })
      .catch(err => {
        ws.close(1008, 'Authentication failed');
      });
  }

  /**
   * 处理消息
   */
  async handleMessage(ws, message) {
    const client = this.clients.get(ws);
    if (!client) return;

    const data = JSON.parse(message);

    switch (data.type) {
      case 'command':
        await this.handleCommand(ws, client, data);
        break;
      case 'shell':
        await this.handleShell(ws, client, data);
        break;
    }
  }

  /**
   * 处理命令执行
   */
  async handleCommand(ws, client, data) {
    const { command } = data;

    try {
      const stream = await this.containerManager.execInContainer(
        client.userId,
        command
      );

      stream.on('data', (chunk) => {
        ws.send(JSON.stringify({
          type: 'output',
          data: chunk.toString()
        }));
      });
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }

  /**
   * 处理断开连接
   */
  handleDisconnect(ws) {
    this.clients.delete(ws);
  }
}

export default WebSocketManager;
```

### 2.4 文件操作容器化

```javascript
/**
 * server/services/container/FileContainer.js
 *
 * 容器内文件操作服务
 */

import ContainerManager from './ContainerManager.js';

class FileContainer {
  constructor() {
    this.containerManager = new ContainerManager();
  }

  /**
   * 读取容器内文件
   * @param {number} userId - 用户 ID
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件内容
   */
  async readFile(userId, filePath) {
    // 路径安全验证
    this.validatePath(filePath);

    const command = `cat "${filePath}"`;
    const stream = await this.containerManager.execInContainer(userId, command);

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  /**
   * 写入容器内文件
   * @param {number} userId - 用户 ID
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   */
  async writeFile(userId, filePath, content) {
    this.validatePath(filePath);

    const escapedContent = content.replace(/'/g, "'\\''");
    const command = `echo '${escapedContent}' > "${filePath}"`;

    await this.containerManager.execInContainer(userId, command);
  }

  /**
   * 获取文件树
   * @param {number} userId - 用户 ID
   * @param {string} dirPath - 目录路径
   * @returns {Promise<Array>} 文件树
   */
  async getFileTree(userId, dirPath = '/workspace') {
    this.validatePath(dirPath);

    const command = `find "${dirPath}" -type f -o -type d`;
    const stream = await this.containerManager.execInContainer(userId, command);

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        const lines = output.trim().split('\n');
        resolve(lines);
      });

      stream.on('error', reject);
    });
  }

  /**
   * 路径安全验证
   * @param {string} filePath - 文件路径
   */
  validatePath(filePath) {
    // 防止路径遍历攻击
    if (filePath.includes('..')) {
      throw new Error('Invalid path: path traversal detected');
    }

    // 确保路径在 /workspace 内
    const resolvedPath = path.resolve('/workspace', filePath);
    if (!resolvedPath.startsWith('/workspace')) {
      throw new Error('Invalid path: outside workspace');
    }
  }
}

export default FileContainer;
```

---

## 相关文档

- [架构概述](./architecture-overview.md)
- [数据存储设计](./data-storage-design.md)
- [安全与部署配置](./security-deployment-config.md)

---

**文档维护**

本文档应该根据实际实施情况持续更新。如有任何疑问或建议，请联系项目维护者。

**版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-10 | Claude | 初始版本 |
