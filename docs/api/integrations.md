# AI 集成模块

> **最后更新**: 2026-04-17

---

## 12. Claude 集成

> 路由源码: `backend/routes/integrations/claude.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/claude/execute` | JWT | 执行 Claude 命令 |
| POST | `/api/claude/abort` | JWT | 中止 Claude 会话 |
| GET | `/api/claude/sessions` | JWT | 获取所有活动 Claude 会话 |
| GET | `/api/claude/sessions/:sessionId/active` | JWT | 检查会话是否活跃 |
| GET | `/api/claude/sessions/:sessionId/info` | JWT | 获取会话信息 |

### 请求参数

**POST /api/claude/execute**
```json
{
  "command": "string (required)",
  "projectPath": "string (optional)",
  "sessionId": "string (optional) - 继续已有会话",
  "model": "string (optional)",
  "permissionMode": "string (optional)"
}
```

**POST /api/claude/abort**
```json
{
  "sessionId": "string (required)"
}
```

---

## 13. Cursor 集成

> 路由源码: `backend/routes/integrations/ai-providers/cursor.js`

### CLI 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cursor/config` | 读取 Cursor CLI 配置 |
| POST | `/api/cursor/config` | 更新 Cursor CLI 配置 |

**POST /api/cursor/config**
```json
{
  "permissions": "object (optional)",
  "model": "string (optional)"
}
```

### MCP 服务器管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cursor/mcp` | 读取 Cursor MCP 服务器配置 |
| POST | `/api/cursor/mcp/add` | 添加 MCP 服务器 |
| DELETE | `/api/cursor/mcp/:name` | 删除 MCP 服务器 |
| POST | `/api/cursor/mcp/add-json` | 通过 JSON 添加 MCP 服务器 |

**POST /api/cursor/mcp/add**
```json
{
  "name": "string (required)",
  "type": "string (default: 'stdio')",
  "command": "string",
  "args": ["string[]"],
  "url": "string",
  "headers": {},
  "env": {}
}
```

**POST /api/cursor/mcp/add-json**
```json
{
  "name": "string (required)",
  "jsonConfig": "string | object (required)"
}
```

### 会话查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cursor/sessions` | 获取 Cursor 会话列表 |
| GET | `/api/cursor/sessions/:sessionId` | 获取特定 Cursor 会话 |

**GET /api/cursor/sessions**
| 查询参数 | 类型 | 说明 |
|----------|------|------|
| projectPath | string | 项目路径过滤 |

---

## 14. Codex 集成

> 路由源码: `backend/routes/integrations/ai-providers/codex.js`

### 配置与会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/codex/config` | 读取 Codex 配置（~/.codex/config.toml） |
| GET | `/api/codex/sessions` | 获取 Codex 会话列表 |
| GET | `/api/codex/sessions/:sessionId/messages` | 获取会话消息 |
| DELETE | `/api/codex/sessions/:sessionId` | 删除 Codex 会话 |

**GET /api/codex/sessions**
| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| projectPath | string | 是 | 项目路径 |

**GET /api/codex/sessions/:sessionId/messages**
| 查询参数 | 类型 | 说明 |
|----------|------|------|
| limit | number | 消息数量限制 |
| offset | number | 偏移量 |

### MCP CLI 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/codex/mcp/cli/list` | 通过 CLI 列出 MCP 服务器 |
| POST | `/api/codex/mcp/cli/add` | 通过 CLI 添加 MCP 服务器 |
| DELETE | `/api/codex/mcp/cli/remove/:name` | 通过 CLI 删除 MCP 服务器 |
| GET | `/api/codex/mcp/cli/get/:name` | 通过 CLI 获取 MCP 服务器详情 |
| GET | `/api/codex/mcp/config/read` | 读取 Codex MCP 配置文件 |

**POST /api/codex/mcp/cli/add**
```json
{
  "name": "string (required)",
  "command": "string (required)",
  "args": ["string[]"],
  "env": {}
}
```

---

## 15. MCP 集成 (Claude CLI)

> 路由源码: `backend/routes/integrations/mcp.js`

通过 Claude CLI 管理 MCP 服务器配置。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp/cli/list` | 列出 MCP 服务器 |
| POST | `/api/mcp/cli/add` | 添加 MCP 服务器 |
| POST | `/api/mcp/cli/add-json` | 通过 JSON 添加 MCP 服务器 |
| DELETE | `/api/mcp/cli/remove/:name` | 删除 MCP 服务器 |
| GET | `/api/mcp/cli/get/:name` | 获取 MCP 服务器详情 |
| GET | `/api/mcp/config/read` | 读取 Claude 配置文件中的 MCP 服务器 |

**POST /api/mcp/cli/add**
```json
{
  "name": "string (required)",
  "type": "string - stdio | http | sse",
  "command": "string (stdio 类型)",
  "args": ["string[]"],
  "url": "string (http/sse 类型)",
  "headers": {},
  "env": {},
  "scope": "string (default: 'user') - 'user' 或 'local'",
  "projectPath": "string (scope=local 时必填)"
}
```

**POST /api/mcp/cli/add-json**
```json
{
  "name": "string (required)",
  "jsonConfig": "string | object (required)",
  "scope": "string (default: 'user')",
  "projectPath": "string (scope=local 时必填)"
}
```

---

## 16. Agent API

> 路由源码: `backend/routes/integrations/agent.js`

外部 Agent API，支持通过 API Key 或平台模式认证触发 AI 代理工作。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/agent` | API Key / 平台模式 | 触发 AI 代理执行任务 |

### 认证方式

- **平台模式**: `VITE_IS_PLATFORM=true` 时，自动使用系统用户
- **API Key 模式**: 请求头 `x-api-key` 或查询参数 `apiKey`

### 请求参数

```json
{
  "githubUrl": "string (与 projectPath 二选一) - GitHub 仓库 URL",
  "projectPath": "string (与 githubUrl 二选一) - 本地项目路径",
  "message": "string (required) - 任务描述",
  "provider": "string (default: 'claude') - 'claude' | 'cursor' | 'codex'",
  "model": "string (optional) - 模型标识",
  "stream": "boolean (default: true) - 是否启用 SSE 流式响应",
  "cleanup": "boolean (default: true) - 完成后是否清理克隆的仓库",
  "githubToken": "string (optional) - GitHub 令牌",
  "branchName": "string (optional) - 自定义分支名",
  "createBranch": "boolean (default: false) - 完成后创建新分支",
  "createPR": "boolean (default: false) - 完成后创建 Pull Request"
}
```

### SSE 流式事件类型

| 事件 type | 说明 |
|-----------|------|
| `status` | 状态更新 |
| `github-branch` | 分支创建信息 |
| `github-pr` | PR 创建信息 |
| `github-error` | GitHub 操作错误 |
| `error` | 一般错误 |

---

## 17. CLI 认证状态

> 路由源码: `backend/routes/cli-auth.js`

检查各 AI CLI 工具的认证状态。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cli/claude/status` | 检查 Claude CLI 认证状态 |
| GET | `/api/cli/cursor/status` | 检查 Cursor CLI 认证状态 |
| GET | `/api/cli/codex/status` | 检查 Codex CLI 认证状态 |

### 响应格式

```json
{
  "authenticated": true,
  "email": "user@example.com",
  "error": null
}
```

---

## 19. TaskMaster 集成

> 路由源码: `backend/routes/integrations/taskmaster/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/taskmaster/installation-status` | 检查 TaskMaster CLI 安装状态 |
| GET | `/api/taskmaster/detect/:projectName` | 检测项目的 TaskMaster 配置 |
| GET | `/api/taskmaster/detect-all` | 检测所有项目的 TaskMaster 配置 |
| GET | `/api/taskmaster/next/:projectName` | 获取下一个推荐任务 |
| GET | `/api/taskmaster/tasks/:projectName` | 加载 tasks.json 中的任务列表 |
