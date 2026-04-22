# 设计模式文档 (Design Patterns Documentation)

## 概述 (Overview)

本文档记录了 Claude Code UI 项目中使用的核心设计模式及其实现。这些模式解决了容器生命周期管理、文件操作抽象、实时通信、错误处理和多 AI 提供商集成等关键问题。

---

## 1. 状态机模式 (State Machine Pattern)

### 意图与动机 (Intent & Motivation)

管理容器的完整生命周期，防止并发创建和竞态条件。通过明确的状态转换规则，确保容器状态变更的可预测性和线程安全性。

**核心问题：**
- 容器创建过程复杂，涉及多个中间状态（CREATING、STARTING、HEALTH_CHECKING）
- 并发请求可能导致重复创建或状态不一致
- 需要状态持久化以支持服务重启恢复

**解决方案：**
使用状态机模式封装状态转换逻辑，通过 `ContainerStateMachine` 类集中管理所有状态变更。

### 代码位置 (Location)

- **核心实现：** `/backend/services/container/core/ContainerStateMachine.js`
- **状态转换：** `/backend/services/container/core/containerStateTransitions.js`
- **状态处理器：** `/backend/services/container/core/ContainerStateMachineHandler.js`

### 代码示例 (Code Example)

```javascript
/**
 * 容器状态机类
 * @extends EventEmitter
 */
export class ContainerStateMachine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentState = ContainerState.NON_EXISTENT;
    this.previousState = null;
    this.stateHistory = [ContainerState.NON_EXISTENT];
    this._stateWaiters = new Map();
    this._isCreating = false; // 创建操作保护标志
  }

  /**
   * 转换到新状态（核心状态转换逻辑）
   * @param {string} newState - 目标状态
   * @param {Object} metadata - 转换元数据
   * @throws {Error} 如果状态转换无效
   */
  transitionTo(newState, metadata = {}) {
    const previousState = this.currentState;

    // 验证状态转换合法性
    if (!canTransitionTo(this.currentState, newState)) {
      throw new Error(
        `Invalid state transition from ${previousState} to ${newState}`
      );
    }

    // 执行状态转换
    this.previousState = previousState;
    this.currentState = newState;
    this.stateHistory.push(newState);
    this.lastTransitionTime = new Date();

    // 管理创建操作保护
    if (newState === ContainerState.CREATING) {
      this._isCreating = true;
    } else if (previousState === ContainerState.CREATING) {
      this._isCreating = false;
    }

    // 触发状态变化事件（观察者模式）
    this.emit('stateChanged', {
      from: previousState,
      to: newState,
      userId: this.userId,
      containerName: this.containerName,
      timestamp: this.lastTransitionTime,
      metadata
    });

    // 通知等待状态的协程
    notifyAndWaiters(this._stateWaiters, newState);
    return true;
  }

  /**
   * 等待状态变为指定状态（异步状态等待）
   * @param {string|string[]} targetStates - 目标状态
   * @param {Object} options - 选项（超时等）
   * @returns {Promise<string>}
   */
  async waitForState(targetStates, options = {}) {
    const { timeout = 30000 } = options;
    const targets = Array.isArray(targetStates) ? targetStates : [targetStates];

    if (targets.includes(this.currentState)) return this.currentState;
    if (this.isTerminal()) return this.currentState;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        removeWaiter(this._stateWaiters, this.currentState, resolve);
        reject(new Error(`Timeout waiting for state`));
      }, timeout);

      addWaiter(this._stateWaiters, this.currentState, (newState) => {
        clearTimeout(timer);
        resolve(newState);
      }, targets);
    });
  }
}
```

**状态机工作流集成：**

```javascript
/**
 * 使用状态机创建容器
 * @file ContainerStateMachineHandler.js
 */
export async function createContainerWithStateMachine(
  docker, userId, userConfig, stateMachine, containers, config
) {
  stateMachine.beginCreation();
  try {
    // Step 1: CREATING
    stateMachine.transitionTo(ContainerState.CREATING);
    await containerStateStore.save(stateMachine);
    const containerInfo = await doCreateContainer(docker, userId, userConfig, config);
    containers.set(userId, containerInfo);

    // Step 2: STARTING
    stateMachine.transitionTo(ContainerState.STARTING);
    await containerStateStore.save(stateMachine);

    // Step 3: HEALTH_CHECKING → READY
    stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
    await containerStateStore.save(stateMachine);

    const healthMonitor = new ContainerHealthMonitor(docker);
    await healthMonitor.waitForContainerReady(containerInfo.id);

    stateMachine.transitionTo(ContainerState.READY);
    await containerStateStore.save(stateMachine);
    return containerInfo;
  } catch (error) {
    stateMachine.setFailed(error);
    await containerStateStore.save(stateMachine);
    throw error;
  } finally {
    stateMachine.endCreation();
  }
}
```

### 优势 (Benefits)

1. **并发安全：** `_isCreating` 标志防止重复创建
2. **状态可追溯：** 完整的状态历史记录（`stateHistory`）
3. **异步等待：** 支持协程等待状态变化（`waitForState`）
4. **持久化支持：** `toJSON()` / `fromJSON()` 支持服务重启后恢复状态
5. **事件驱动：** 集成 EventEmitter 支持状态变化监听

---

## 2. 适配器模式 (Adapter Pattern)

### 意图与动机 (Intent & Motivation)

统一不同环境下的文件操作接口。系统支持本地文件系统和 Docker 容器内文件系统，适配器模式将差异封装在具体适配器类中，对外提供统一的 `IFileOperations` 接口。

**核心问题：**
- 本地文件系统使用 Node.js `fs` 模块
- 容器文件系统需要通过 Dockerode API 执行命令
- 需要统一接口避免业务逻辑耦合具体实现

**解决方案：**
定义抽象基类 `BaseFileAdapter`，具体适配器（如 `FileAdapter`）继承并实现抽象方法。

### 代码位置 (Location)

- **抽象基类：** `/backend/services/files/adapters/BaseFileAdapter.js`
- **容器适配器：** `/backend/services/files/adapters/FileAdapter.js`
- **接口定义：** `/backend/core/interfaces/IFileOperations.js`

### 代码示例 (Code Example)

**抽象基类定义统一接口：**

```javascript
/**
 * 抽象文件适配器基类
 * 所有文件操作适配器都必须继承此类并实现抽象方法
 * @file BaseFileAdapter.js
 */
export class BaseFileAdapter extends IFileOperations {
  constructor(config = {}) {
    super();
    this.name = config.name || 'BaseAdapter';
    this.version = config.version || '1.0.0';
    this.maxFileSize = config.maxFileSize || FILE_SIZE_LIMITS.MAX_SIZE;
  }

  /**
   * 读取文件内容（抽象方法，子类必须实现）
   * @abstract
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @throws {Error} 如果子类未实现
   */
  async readFile(filePath, options = {}) {
    throw new Error(`readFile() must be implemented by ${this.name}`);
  }

  /**
   * 写入文件内容（抽象方法，子类必须实现）
   * @abstract
   */
  async writeFile(filePath, content, options = {}) {
    throw new Error(`writeFile() must be implemented by ${this.name}`);
  }

  /**
   * 获取文件树结构（抽象方法，子类必须实现）
   * @abstract
   */
  async getFileTree(dirPath, options = {}) {
    throw new Error(`getFileTree() must be implemented by ${this.name}`);
  }

  // ... 其他抽象方法

  /**
   * 标准化错误消息（模板方法，子类可复用）
   * @protected
   */
  _standardizeError(error, operation, context = {}) {
    return standardizeErrorUtil(error, operation, {
      adapter: this.name,
      ...context
    });
  }
}
```

**容器适配器实现：**

```javascript
/**
 * 文件操作适配器（容器实现）
 * 在用户专属的 Docker 容器中执行文件操作
 * @file FileAdapter.js
 */
export class FileAdapter extends BaseFileAdapter {
  constructor(config = {}) {
    super({
      name: 'FileAdapter',
      version: '2.0.0',
      ...config
    });
    this.adapterType = 'container';

    // 组合模式：委托给具体操作类
    this.reader = new FileReader(this);
    this.writer = new FileWriter(this);
    this.treeBuilder = new FileTreeBuilder(this);
    this.renamer = new FileRenamer(this);
    this.mover = new FileMover(this);
    this.directoryCreator = new DirectoryCreator(this);
  }

  /**
   * 读取文件内容（实现抽象方法）
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项（含 userId）
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    try {
      return await this.reader.read(filePath, options);
    } catch (error) {
      throw this._standardizeError(error, 'readFile');
    }
  }

  /**
   * 写入文件内容（实现抽象方法）
   */
  async writeFile(filePath, content, options = {}) {
    try {
      return await this.writer.write(filePath, content, options);
    } catch (error) {
      throw this._standardizeError(error, 'writeFile');
    }
  }

  /**
   * 获取文件树结构（实现抽象方法）
   */
  async getFileTree(dirPath, options = {}) {
    try {
      return await this.treeBuilder.build(dirPath, options);
    } catch (error) {
      throw this._standardizeError(error, 'getFileTree');
    }
  }
}
```

### 优势 (Benefits)

1. **接口统一：** 业务代码通过 `BaseFileAdapter` 接口调用，不关心底层实现
2. **扩展性强：** 新增 S3、FTP 适配器只需继承 `BaseFileAdapter`
3. **职责分离：** 具体操作（读写、重命名）委托给独立的操作类（`FileReader`、`FileWriter`）
4. **错误标准化：** 基类提供 `_standardizeError` 模板方法统一错误格式

---

## 3. 中间件链模式 (Middleware Chain Pattern)

### 意图与动机 (Intent & Motivation)

Express.js 中间件链用于处理请求/响应的生命周期，包括身份验证、错误处理、响应格式化等横切关注点。

**核心问题：**
- 需要统一处理认证、错误、日志、响应格式等
- 这些逻辑与具体路由业务逻辑分离
- 需要灵活组合和顺序控制

**解决方案：**
利用 Express 中间件机制，将不同关注点封装为独立中间件，通过 `app.use()` 组装成处理链。

### 代码位置 (Location)

- **错误处理：** `/backend/middleware/error-handler.middleware.js`
- **认证中间件：** `/backend/middleware/auth.middleware.js`
- **响应格式化：** `/backend/middleware/response-formatter.middleware.js`
- **统一导出：** `/backend/middleware/index.js`

### 代码示例 (Code Example)

**错误处理中间件（链的末端）：**

```javascript
/**
 * 错误处理中间件（捕获所有路由错误）
 * @file error-handler.middleware.js
 */
function errorHandler(err, req, res, next) {
  // 记录错误
  _logError(err, req);

  // 处理应用自定义错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toResponse());
  }

  // 处理验证错误（来自 express-validator）
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      error: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
      details: { errors: err.errors }
    });
  }

  // 处理 SQLite 错误
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'Resource already exists',
      code: ErrorCode.ALREADY_EXISTS
    });
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(403).json({
      error: 'Invalid token',
      code: ErrorCode.INVALID_TOKEN
    });
  }

  // 处理未知错误
  logger.error({ err }, `Unhandled error: ${err.message}`);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: ErrorCode.INTERNAL_ERROR
  });
}

/**
 * 异步路由包装器（捕获异步函数中的错误）
 * @param {Function} fn - 异步路由函数
 * @returns {Function} 包装后的路由函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**中间件链组装示例：**

```javascript
import { errorHandler, notFoundHandler, authenticate, asyncHandler } from './middleware/index.js';

// 应用级中间件
app.use(express.json());
app.use(authenticate); // 认证中间件
app.use(responseFormatter); // 响应格式化中间件

// 路由（使用 asyncHandler 捕获异步错误）
app.get('/api/containers', asyncHandler(async (req, res) => {
  const containers = await containerManager.getAllContainers(req.user.userId);
  res.json(containers);
}));

// 404 处理
app.use(notFoundHandler);

// 错误处理中间件（必须放在最后）
app.use(errorHandler);
```

### 优势 (Benefits)

1. **关注点分离：** 认证、错误、日志等逻辑独立封装
2. **统一错误处理：** `errorHandler` 集中处理所有错误类型
3. **异步错误捕获：** `asyncHandler` 解决 Express 不捕获异步函数错误的问题
4. **灵活组合：** 通过 `app.use()` 灵活调整中间件顺序

---

## 4. 观察者模式 (Observer Pattern)

### 意图与动机 (Intent & Motivation)

实现实时通信，将 AI 执行结果流式推送给前端。WebSocket 服务器作为主题（Subject），多个客户端连接作为观察者（Observer），通过事件订阅机制接收消息。

**核心问题：**
- AI 执行过程是长耗时操作，需要流式返回结果
- 多个客户端可能同时连接，需要独立会话管理
- 需要支持会话恢复和中断

**解决方案：**
基于 `ws` 库实现 WebSocket 服务器，每个连接独立路由到不同处理器（`/ws` 聊天、`/shell` 终端）。

### 代码位置 (Location)

- **WebSocket 服务器：** `/backend/websocket/server.js`
- **聊天处理器：** `/backend/websocket/handlers/chat.js`
- **终端处理器：** `/backend/websocket/handlers/shell.js`
- **消息写入器：** `/backend/websocket/writer.js`

### 代码示例 (Code Example)

**WebSocket 服务器（主题）：**

```javascript
/**
 * 创建并配置 WebSocket 服务器
 * @file websocket/server.js
 */
export function createWebSocketServer(server, connectedClients, ptySessionsMap) {
  const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
      // 身份验证逻辑
      const token = extractToken(info.req);
      const user = authenticateWebSocket(token);
      if (!user) return false;
      info.req.user = user;
      return true;
    }
  });

  // 新连接建立事件
  wss.on('connection', (ws, request) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    // 路由到不同处理器（策略模式）
    if (pathname === '/shell') {
      handleShellConnection(ws, ptySessionsMap);
    } else if (pathname === '/ws') {
      handleChatConnection(ws, connectedClients);
    } else {
      ws.close();
    }
  });

  return wss;
}
```

**聊天处理器（观察者）：**

```javascript
/**
 * 处理聊天 WebSocket 连接
 * @file websocket/handlers/chat.js
 */
export function handleChatConnection(ws, connectedClients) {
  const writer = new WebSocketWriter(ws);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      // 路由到不同的消息处理器
      switch (message.type) {
        case 'claude-command':
          await handleClaudeCommand(message, ws, writer);
          break;
        case 'cursor-command':
          await handleCursorCommand(message, ws, writer);
          break;
        case 'codex-command':
          await handleCodexCommand(message, ws, writer);
          break;
        case 'abort-session':
          abortSession(message, writer);
          break;
        default:
          writer.send({ type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      logger.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    logger.info('Client disconnected');
  });
}
```

**WebSocket 写入器（封装消息发送）：**

```javascript
/**
 * WebSocket 写入器
 * 提供统一的消息发送接口
 * @file websocket/writer.js
 */
export class WebSocketWriter {
  constructor(ws) {
    this.ws = ws;
  }

  /**
   * 发送消息（仅在连接就绪时发送）
   * @param {Object} message - 消息对象
   */
  send(message) {
    if (this.ws.readyState === 1) { // OPEN 状态
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送流式内容块
   * @param {Object} contentBlock - 内容块对象
   */
  sendContentBlock(contentBlock) {
    this.send({
      type: 'content_block_delta',
      ...contentBlock
    });
  }
}
```

### 优势 (Benefits)

1. **实时推送：** AI 执行结果流式返回，无需轮询
2. **会话隔离：** 每个 WebSocket 连接独立管理会话
3. **消息路由：** 通过消息类型（`type` 字段）路由到不同处理器
4. **错误隔离：** 单个客户端错误不影响其他连接

---

## 5. 工厂方法模式 (Factory Method Pattern)

### 意图与动机 (Intent & Motivation)

根据不同场景创建容器实例。系统需要根据用户配置、资源限制等条件创建不同配置的容器，工厂方法封装创建逻辑。

**核心问题：**
- 容器创建涉及多个步骤（配置、镜像选择、网络设置、挂载点）
- 需要根据用户等级（free/tier）选择不同配置
- 创建过程需要重试和错误恢复

**解决方案：**
`ContainerManager` 提供 `getOrCreateContainer` 工厂方法，内部调用 `createContainerWithStateMachine` 完成创建。

### 代码位置 (Location)

- **容器管理器：** `/backend/services/container/core/index.js`
- **状态机创建器：** `/backend/services/container/core/ContainerStateMachineHandler.js`
- **容器操作：** `/backend/services/container/core/ContainerOperations.js`

### 代码示例 (Code Example)

**工厂方法（简化版）：**

```javascript
/**
 * 容器管理器（工厂）
 * @file services/container/core/index.js
 */
class ContainerManager {
  constructor() {
    this.containers = new Map(); // userId -> containerInfo
    this.stateMachines = new Map(); // userId -> stateMachine
  }

  /**
   * 获取或创建容器（工厂方法）
   * @param {number} userId - 用户 ID
   * @param {Object} options - 选项（含 tier、model 等）
   * @returns {Promise<Object>} 容器信息
   */
  async getOrCreateContainer(userId, options = {}) {
    // 如果容器已存在且状态为 READY，直接返回
    const existing = this.containers.get(userId);
    const stateMachine = this.stateMachines.get(userId);

    if (existing && stateMachine?.is(ContainerState.READY)) {
      logger.debug(`Container for user ${userId} already exists`);
      return existing;
    }

    // 创建新容器
    return this._createContainer(userId, options);
  }

  /**
   * 创建容器（内部工厂方法）
   * @private
   */
  async _createContainer(userId, options) {
    const docker = await this._getDocker();
    const userConfig = await this._loadUserConfig(userId);
    const stateMachine = new ContainerStateMachine({
      userId,
      containerName: `claude-user-${userId}`,
      initialState: ContainerState.NON_EXISTENT
    });

    this.stateMachines.set(userId, stateMachine);

    // 委托给状态机创建器
    const containerInfo = await createContainerWithStateMachine(
      docker,
      userId,
      userConfig,
      stateMachine,
      this.containers,
      {
        image: options.tier === 'pro' ? PRO_IMAGE : FREE_IMAGE,
        network: 'claude-network',
        dataDir: config.DATA_DIR
      }
    );

    return containerInfo;
  }
}
```

**容器创建实现：**

```javascript
/**
 * 使用状态机创建容器
 * @file ContainerStateMachineHandler.js
 */
export async function createContainerWithStateMachine(
  docker, userId, userConfig, stateMachine, containers, config
) {
  stateMachine.beginCreation();
  try {
    // Step 1: CREATING
    stateMachine.transitionTo(ContainerState.CREATING);
    await containerStateStore.save(stateMachine);
    const containerInfo = await doCreateContainer(docker, userId, userConfig, config);
    containers.set(userId, containerInfo);

    // Step 2: STARTING
    stateMachine.transitionTo(ContainerState.STARTING);
    await containerStateStore.save(stateMachine);

    // Step 3: HEALTH_CHECKING → READY
    stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
    await containerStateStore.save(stateMachine);

    const healthMonitor = new ContainerHealthMonitor(docker);
    await healthMonitor.waitForContainerReady(containerInfo.id);

    stateMachine.transitionTo(ContainerState.READY);
    await containerStateStore.save(stateMachine);
    return containerInfo;
  } catch (error) {
    stateMachine.setFailed(error);
    await containerStateStore.save(stateMachine);
    throw error;
  } finally {
    stateMachine.endCreation();
  }
}
```

### 优势 (Benefits)

1. **封装创建逻辑：** 调用者无需关心容器创建细节
2. **单例保证：** `getOrCreateContainer` 确保每个用户只有一个容器
3. **状态机集成：** 创建过程与状态机深度集成，保证状态一致性
4. **可测试性：** 工厂方法易于 Mock 和单元测试

---

## 6. 策略模式 (Strategy Pattern)

### 意图与动机 (Intent & Motivation)

支持多个 AI 提供商（Claude、Cursor、Codex）的统一调用接口。不同提供商的执行逻辑差异大，策略模式将具体执行算法封装为独立策略类。

**核心问题：**
- Claude 使用 `@anthropic-ai/claude-agent-sdk` 在容器内执行
- Cursor 通过启动 `cursor-agent` 进程执行
- Codex 使用 `@openai/codex-sdk` 执行
- 需要统一接口供 WebSocket 处理器调用

**解决方案：**
定义 `BaseExecutionEngine` 接口，不同提供商实现自己的 `ExecutionEngine`，通过消息类型路由到对应策略。

### 代码位置 (Location)

- **基础引擎接口：** `/backend/services/execution/engines/BaseExecutionEngine.js`
- **Claude 引擎：** `/backend/services/execution/engines/ExecutionEngine.js`
- **Claude 执行器：** `/backend/services/execution/claude/ClaudeExecutor.js`
- **Cursor 执行器：** `/backend/services/execution/cursor/CursorExecutor.js`
- **Codex 执行器：** `/backend/services/execution/codex/CodexExecutor.js`
- **消息路由：** `/backend/websocket/handlers/chat.js`

### 代码示例 (Code Example)

**策略路由（根据消息类型选择执行器）：**

```javascript
/**
 * 聊天 WebSocket 处理器（策略上下文）
 * @file websocket/handlers/chat.js
 */
export function handleChatConnection(ws, connectedClients) {
  const writer = new WebSocketWriter(ws);

  ws.on('message', async (data) => {
    const message = JSON.parse(data);

    // 策略路由：根据消息类型选择执行器
    switch (message.type) {
      case 'claude-command':
        await handleClaudeCommand(message, ws, writer);
        break;
      case 'cursor-command':
        await handleCursorCommand(message, ws, writer);
        break;
      case 'codex-command':
        await handleCodexCommand(message, ws, writer);
        break;
      case 'abort-session':
        abortSession(message, writer); // 多态调用
        break;
    }
  });
}

/**
 * 中止会话（多态策略调用）
 * @param {Object} data - 请求数据
 * @param {string} data.provider - 提供商（claude/cursor/codex）
 */
function abortSession(data, writer) {
  const provider = data.provider || 'claude';
  let success;

  // 根据提供商选择中止策略
  if (provider === 'cursor') {
    success = abortCursorSession(data.sessionId);
  } else if (provider === 'codex') {
    success = abortCodexSession(data.sessionId);
  } else {
    success = abortClaudeSDKSessionInContainer(data.sessionId);
  }

  return {
    type: 'session-aborted',
    sessionId: data.sessionId,
    provider,
    success
  };
}
```

**Claude 策略实现：**

```javascript
/**
 * Claude 执行器（策略实现）
 * @file execution/claude/ClaudeExecutor.js
 */
export class ClaudeExecutor {
  constructor(config = {}) {
    this.activeSessions = new Map();
    this.config = config;
  }

  /**
   * 执行 Claude 查询（策略方法）
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   * @returns {Promise<{sessionId: string}>}
   */
  async execute(command, options = {}, writer) {
    const { sessionId } = options;
    let capturedSessionId = sessionId;
    let queryInstance = null;

    try {
      const sdkOptions = await this._prepareSdkOptions(options, command);
      queryInstance = query({
        prompt: command,
        options: sdkOptions
      });

      addSession(this.activeSessions, capturedSessionId, queryInstance);

      // 流式处理消息
      capturedSessionId = await processStreamMessages(
        queryInstance,
        capturedSessionId,
        sessionId,
        writer,
        (sid, inst) => addSession(this.activeSessions, sid, inst),
        handleNewSession
      );

      return { sessionId: capturedSessionId };
    } catch (error) {
      handleExecutionError(error, writer);
      throw error;
    }
  }
}
```

**Cursor 策略实现（简化版）：**

```javascript
/**
 * Cursor 执行器（策略实现）
 * @file execution/cursor/CursorExecutor.js
 */
export class CursorExecutor {
  constructor(config = {}) {
    this.activeSessions = new Map();
  }

  /**
   * 执行 Cursor 命令（策略方法）
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   */
  async execute(command, options = {}, writer) {
    const { sessionId, cwd, projectPath } = options;

    // 启动 cursor-agent 进程
    const cursorProcess = spawn('cursor-agent', [], {
      cwd: projectPath || cwd,
      env: { ...process.env, CURSOR_SESSION_ID: sessionId }
    });

    this.activeSessions.set(sessionId, cursorProcess);

    // 处理进程输出
    cursorProcess.stdout.on('data', (data) => {
      writer.send({
        type: 'content_block_delta',
        sessionId,
        delta: { text: data.toString() }
      });
    });

    return { sessionId };
  }
}
```

### 优势 (Benefits)

1. **算法族封装：** 每个提供商的执行逻辑独立封装
2. **运行时切换：** 通过消息类型动态选择策略
3. **易于扩展：** 新增提供商只需实现新的 `Executor` 类
4. **会话管理统一：** 所有策略都维护 `activeSessions` Map，支持会话中断

---

## 总结 (Summary)

| 设计模式 | 核心问题 | 解决方案 | 关键文件 |
|---------|---------|---------|---------|
| **状态机模式** | 容器生命周期管理复杂，存在并发竞态 | `ContainerStateMachine` 封装状态转换逻辑 | `ContainerStateMachine.js` |
| **适配器模式** | 本地/容器文件系统接口不统一 | `BaseFileAdapter` 定义统一接口，子类实现 | `BaseFileAdapter.js`, `FileAdapter.js` |
| **中间件链模式** | 认证、错误、日志等横切逻辑复用 | Express 中间件链组装处理流程 | `error-handler.middleware.js` |
| **观察者模式** | AI 执行结果需要实时推送 | WebSocket 服务器作为主题，客户端作为观察者 | `websocket/server.js`, `handlers/chat.js` |
| **工厂方法模式** | 容器创建涉及多个步骤和配置 | `getOrCreateContainer` 封装创建逻辑 | `ContainerStateMachineHandler.js` |
| **策略模式** | 多 AI 提供商执行逻辑差异大 | 每个提供商独立实现 `Executor`，消息路由选择策略 | `ClaudeExecutor.js`, `CursorExecutor.js` |

这些设计模式共同构建了一个可维护、可扩展、高内聚低耦合的系统架构。

---

**文档版本：** v1.0
**最后更新：** 2026-04-21
**维护者：** Claude Code UI 团队
