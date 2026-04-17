# REST API 文档

> **最后更新**: 2026-04-17
> **Base URL**: `http://<host>:<port>/api`

## 概述

Claude Code UI 提供 RESTful HTTP API 用于管理项目、会话、文件、Git 操作以及与多种 AI 引擎（Claude、Cursor、Codex）集成。所有 API 端点均挂载在 `/api` 路径下。

实时交互（AI 命令执行、终端 I/O）通过 WebSocket 完成，详见 [WebSocket 消息类型](websocket.md)。

---

## 目录

| 模块 | 文档 | 说明 |
|------|------|------|
| Auth & SAML | [auth.md](auth.md) | 认证、登录、SAML SSO |
| Users & Settings | [users.md](users.md) | 用户信息、设置、提供商配置、MCP 服务器 |
| Projects | [projects.md](projects.md) | 项目 CRUD、工作空间创建 |
| Sessions | [sessions.md](sessions.md) | 会话查询、搜索、删除 |
| Files | [files.md](files.md) | 文件读写、目录管理、上传 |
| Git | [git.md](git.md) | 状态查询、提交、分支、远程操作 |
| Memory | [memory.md](memory.md) | CLAUDE.md 记忆文件管理 |
| Integrations | [integrations.md](integrations.md) | Claude/Cursor/Codex/MCP/Agent/CLI/TaskMaster |
| Tools & Commands | [tools.md](tools.md) | MCP 工具、扩展管理、命令执行 |
| System & Uploads | [system.md](system.md) | 系统更新、文件浏览、音频转录、健康检查 |
| WebSocket | [websocket.md](websocket.md) | WebSocket 消息类型定义 |

---

## 认证机制

系统支持两种认证方式：

### JWT Token 认证（浏览器会话）

- 登录后服务端设置 `httpOnly` cookie `auth_token`
- 大多数 API 端点通过 `authenticate()` 或 `authenticateToken` 中间件验证
- Token 可通过 `GET /api/auth/ws-token` 获取，用于 WebSocket 连接认证

### API Key 认证（外部 Agent 调用）

- 请求头携带 `x-api-key` 或查询参数 `apiKey`
- 用于 Agent API（`POST /api/agent`）等外部集成场景
- 通过 `validateApiKey` 中间件验证

### 公开端点

以下端点无需认证：

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /api/models` | 获取可用 AI 模型列表 |
| `GET /api/auth/status` | 检查认证状态 |
| `POST /api/auth/register` | 初始用户注册 |
| `POST /api/auth/login` | 用户登录 |
| `GET /api/auth/saml/*` | SAML SSO 相关端点 |

---

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional detailed info"
}
```

---

## 错误码

| HTTP 状态码 | 含义 |
|-------------|------|
| 200 | 请求成功 |
| 400 | 请求参数无效或缺失 |
| 401 | 未认证或认证失败 |
| 403 | 权限不足（如路径遍历防护） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用（如 CLI 未安装） |

---

## 路由源码索引

| 模块 | 文件路径 |
|------|----------|
| Auth | `backend/routes/core/auth.js` |
| SAML | `backend/routes/core/saml.js` |
| Users | `backend/routes/core/users.js` |
| Settings | `backend/routes/core/settings.js` |
| User Settings | `backend/routes/api/user-settings.js` |
| MCP Servers | `backend/routes/api/mcp-servers.js` |
| Projects | `backend/routes/api/projects.js` |
| Sessions | `backend/routes/api/sessions.js` |
| Files | `backend/routes/api/files.js` |
| Git | `backend/routes/api/git.js` |
| Memory | `backend/routes/api/memory.js` |
| Claude | `backend/routes/integrations/claude.js` |
| Cursor | `backend/routes/integrations/ai-providers/cursor.js` |
| Codex | `backend/routes/integrations/ai-providers/codex.js` |
| MCP (Claude CLI) | `backend/routes/integrations/mcp.js` |
| Agent | `backend/routes/integrations/agent.js` |
| TaskMaster | `backend/routes/integrations/taskmaster/` |
| Extensions | `backend/routes/api/extensions.js` |
| Tools Commands | `backend/routes/tools/commands.js` |
| System | `backend/routes/tools/system.js` |
| Uploads | `backend/routes/tools/uploads.js` |
| CLI Auth | `backend/routes/cli-auth.js` |
| MCP Utils | `backend/routes/mcp-utils.js` |
| Custom Commands | `backend/routes/commands.js` |
| Express 配置 | `backend/config/express-config.js` |
| WS Chat Handler | `backend/websocket/handlers/chat.js` |
| WS Shell Handler | `backend/websocket/handlers/shell.js` |
| Message Types | `backend/services/core/types/message-types.js` |
