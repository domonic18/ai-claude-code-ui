# Claude Code UI - Claude AI 上下文文件

## 1. 项目概览

- **愿景：** 为 Claude Code CLI、Cursor CLI 和 OpenAI Codex 提供一个功能完整的多用户 Web 界面
- **当前阶段：** 多用户基础架构已实现，支持自定义模型配置
- **核心架构：**
  - 前端：React 18 + Vite + Tailwind CSS
  - 后端：Express.js + WebSocket (ws) + SQLite
  - AI 集成：@anthropic-ai/claude-agent-sdk、@openai/codex-sdk
- **开发策略：** 前后端分离，实时优先（WebSocket 流式响应），安全优先（工具默认禁用）

## 2. 项目结构

**⚠️ 重要：** 在执行任何任务前，必须先阅读 [架构调研文档](/docs/arch/architecture-overview.md)，了解完整的技术栈、数据流和系统架构。

完整的技术栈和文件树结构：
- **前端** (`frontend/`): React 组件、Context 状态管理、自定义 Hooks
- **后端** (`backend/`): Express API、WebSocket 服务、SDK 集成
- **共享** (`shared/`): 常量定义、工具函数
- **脚本** (`scripts/`): 发布脚本、构建脚本
- **Docker** (`docker/`): Dockerfile、docker-compose 配置
- **文档** (`docs/`): 架构调研、多用户沙箱评估

## 3. 编码规范与 AI 指令

### 通用指令
- 你最重要的工作是管理自己的上下文。在规划变更前，务必先阅读相关文件
- 更新文档时保持简洁明了，防止内容冗余
- 编写代码遵循 KISS、YAGNI 和 DRY 原则
- 未经用户批准不要提交到 git
- 不要运行任何服务器，而是告诉用户运行服务器进行测试
- 优先考虑行业标准库/框架，而不是自定义实现
- 永远不要模拟任何东西，永远不要使用占位符，永远不要省略代码
- 让副作用明确且最小化
- 对想法的好坏要坦率诚实

### 文件组织与模块化
- 默认创建多个小而专注的文件，而不是大而单一的文件
- 每个文件应该有单一职责和明确目的
- 尽可能保持文件在 350 行以内
- 分离关注点：工具、常量、类型、组件和业务逻辑到不同文件
- 遵循现有项目结构和约定
- 使用定义明确的子目录保持组织和可扩展性

### 命名约定（JavaScript/Node.js）
- **组件**：PascalCase（例如 `ChatInterface`、`FileExplorer`）
- **函数/方法**：camelCase（例如 `handleSubmit`、`sendMessage`）
- **常量**：UPPER_SNAKE_CASE（例如 `CLAUDE_MODELS`、`CONTEXT_WINDOW`）
- **私有方法**：前导下划线（例如 `_validateInput`）
- **文件名**：
  - 组件：PascalCase（例如 `ChatInterface.jsx`）
  - 工具/函数：kebab-case（例如 `websocket.js`）
  - 常量：kebab-case（例如 `modelConstants.js`）

### 文档要求
- 每个模块需要 JSDoc 文档字符串
- 每个公共函数需要文档字符串
- 在文档字符串中包含类型信息

```javascript
/**
 * Queries Claude SDK with the given command and options
 * @param {string} command - User prompt/command
 * @param {Object} options - Query options
 * @param {string} options.sessionId - Session identifier for resuming
 * @param {string} options.cwd - Working directory
 * @param {string} options.model - Model to use (sonnet, opus, haiku, etc.)
 * @param {Object} ws - WebSocket connection
 * @returns {Promise<void>}
 */
async function queryClaudeSDK(command, options = {}, ws) {
  // ...
}
```

### 安全优先
- 永远不要信任外部输入 - 在边界处验证一切
- 将密钥保存在环境变量中，永远不要在代码中
- 记录安全事件，但永远不要记录敏感数据（令牌、对话内容、个人信息）
- 使用 JWT Token 进行会话认证
- 文件路径安全检查（防止路径遍历攻击）
- 工具默认禁用，用户主动启用

### 错误处理
- 使用具体异常而不是泛型异常
- 始终记录带上下文的错误
- 提供有用的错误消息
- 安全地失败 - 错误不应该暴露系统内部

### 可观测系统与日志标准
- 使用分级日志：INFO、WARN、ERROR
- 为调试添加上下文信息（会话ID、项目路径等）
- 使跨服务边界的调试成为可能

### 状态管理
- 每个状态片段有一个真相来源
- 让状态变更明确且可追踪
- 使用 React Context 进行全局状态管理
- 使用 localStorage 持久化用户配置

### API 设计原则
- RESTful 设计，带一致的 URL 模式
- 正确使用 HTTP 状态码
- 使用一致的 JSON 响应格式
- WebSocket 用于实时通信

## 4. 任务完成后协议

完成任何编码任务后，遵循此检查清单：

### 1. 代码质量检查
- 确保代码符合项目编码规范
- 检查是否有未使用的依赖或导入
- 验证错误处理是否完善

### 2. 功能验证
- 确保修改不会破坏现有功能
- 检查 WebSocket 消息流是否正常
- 验证文件操作的安全性

### 3. 文档更新
- 如果添加了新功能，更新相关文档
- 更新架构调研文档（如有必要）


**文档维护**：请根据项目发展及时更新此文件
**最后更新**：2026-02-09
