# 用户模块 (Users & Settings)

> **最后更新**: 2026-04-17

---

## 3. 用户模块 (Users)

> 路由源码: `backend/routes/core/users.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/git-config` | JWT | 获取用户 Git 配置（name、email） |
| POST | `/api/users/git-config` | JWT | 更新 Git 配置（同时写入 `git config --global`） |
| POST | `/api/users/complete-onboarding` | JWT | 完成新用户引导 |
| GET | `/api/users/onboarding-status` | JWT | 检查是否已完成引导 |

### 请求参数

**POST /api/users/git-config**
```json
{
  "gitName": "string (required)",
  "gitEmail": "string (required, 合法邮箱格式)"
}
```

---

## 4. 用户设置模块 (Settings)

> 路由源码: `backend/routes/core/settings.js`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/settings` | JWT | 获取所有用户设置 |
| PUT | `/api/settings` | JWT | 更新用户设置 |
| PATCH | `/api/settings/:key` | JWT | 更新单个设置项 |
| DELETE | `/api/settings/:key` | JWT | 删除设置项（恢复默认值） |
| GET | `/api/settings/models` | JWT | 获取可用 AI 模型列表（需认证） |
| GET | `/api/models` | - | 获取可用 AI 模型列表（公开） |

### 请求参数

**PUT /api/settings**
```json
{
  "theme": "string (optional)",
  "language": "string (optional)",
  "editorFontSize": "number (optional)",
  "editorTabSize": "number (optional)",
  "editorWordWrap": "boolean (optional)"
}
```

---

## 5. 用户提供商设置 (User Settings)

> 路由源码: `backend/routes/api/user-settings.js`

管理各 AI 提供商（Claude、Cursor、Codex）的用户级设置。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/settings` | JWT | 获取所有提供商的设置 |
| GET | `/api/users/settings/:provider` | JWT | 获取指定提供商的设置 |
| PUT | `/api/users/settings/:provider` | JWT | 更新指定提供商的设置 |
| GET | `/api/users/settings/:provider/defaults` | JWT | 获取默认设置 |
| GET | `/api/users/settings/:provider/sdk-config` | JWT | 获取 SDK 配置 |
| POST | `/api/users/settings/:provider/reset` | JWT | 重置为默认值 |

### 路径参数

- `provider`: AI 提供商名称，如 `claude`、`cursor`、`codex`

### 请求参数

**PUT /api/users/settings/:provider**
```json
{
  "allowedTools": ["string[] (optional)"],
  "disallowedTools": ["string[] (optional)"],
  "skipPermissions": "boolean (optional)"
}
```

---

## 6. MCP 服务器管理 (User MCP Servers)

> 路由源码: `backend/routes/api/mcp-servers.js`

管理用户级 MCP（Model Context Protocol）服务器配置，存储于数据库中。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/mcp-servers` | JWT | 获取用户的 MCP 服务器列表 |
| GET | `/api/users/mcp-servers/enabled` | JWT | 获取已启用的 MCP 服务器 |
| GET | `/api/users/mcp-servers/sdk-config` | JWT | 获取 MCP SDK 配置 |
| GET | `/api/users/mcp-servers/:id` | JWT | 获取单个 MCP 服务器 |
| POST | `/api/users/mcp-servers` | JWT | 创建 MCP 服务器 |
| PUT | `/api/users/mcp-servers/:id` | JWT | 更新 MCP 服务器 |
| DELETE | `/api/users/mcp-servers/:id` | JWT | 删除 MCP 服务器 |
| POST | `/api/users/mcp-servers/:id/test` | JWT | 测试 MCP 服务器连接 |
| GET | `/api/users/mcp-servers/:id/tools` | JWT | 发现 MCP 服务器的工具列表 |
| POST | `/api/users/mcp-servers/:id/toggle` | JWT | 切换启用/禁用状态 |
| POST | `/api/users/mcp-servers/validate` | JWT | 验证 MCP 服务器配置 |

### 请求参数

**POST /api/users/mcp-servers**
```json
{
  "name": "string (required)",
  "type": "string (required) - 如 stdio、http、sse",
  "config": {
    "command": "string (stdio 类型必填)",
    "args": ["string[]"],
    "url": "string (http/sse 类型必填)",
    "headers": {},
    "env": {}
  }
}
```
