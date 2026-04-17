# 工具与命令模块

> **最后更新**: 2026-04-17

---

## 18. MCP 工具

> 路由源码: `backend/routes/mcp-utils.js`

集中式 MCP 服务器检测工具。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp-utils/taskmaster-server` | 检测 TaskMaster MCP 服务器配置 |
| GET | `/api/mcp-utils/all-servers` | 获取所有已配置的 MCP 服务器 |

---

## 20. 扩展管理 (Extensions)

> 路由源码: `backend/routes/api/extensions.js`

管理预配置扩展（agents、commands、skills）的同步。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/extensions` | JWT | 获取所有可用扩展 |
| POST | `/api/extensions/sync-all` | JWT | 同步扩展到所有用户 |
| POST | `/api/extensions/sync-user` | JWT | 同步扩展到指定用户 |

### 请求参数

**POST /api/extensions/sync-all**
```json
{
  "overwriteUserFiles": "boolean (default: false)"
}
```

**POST /api/extensions/sync-user**
```json
{
  "userId": "number (required)",
  "overwriteUserFiles": "boolean (default: false)"
}
```

---

## 21. 命令工具 (Tools Commands)

> 路由源码: `backend/routes/tools/commands.js`

> **注意**: 挂载路径为 `/api/tools/commands/`，非 `/api/commands/`。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/tools/commands/validate` | JWT | 验证命令是否允许执行 |
| GET | `/api/tools/commands/allowed` | JWT | 获取允许执行的命令列表 |
| POST | `/api/tools/commands/execute` | JWT | 执行命令（通过容器或主机） |

### 请求参数

**POST /api/tools/commands/validate**
```json
{
  "command": "string (required)"
}
```

**POST /api/tools/commands/execute**
```json
{
  "command": "string (required)",
  "cwd": "string (optional) - 工作目录"
}
```

---

## 22. 自定义命令 (Commands)

> 路由源码: `backend/routes/commands.js`

管理斜杠命令（slash commands），包括内置命令和用户自定义命令。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/commands/list` | - | 列出所有可用命令 |
| POST | `/api/commands/load` | - | 加载命令文件内容及元数据 |
| POST | `/api/commands/execute` | - | 执行命令（含参数替换） |

### 请求参数

**POST /api/commands/list**
```json
{
  "projectPath": "string (optional) - 项目路径，用于扫描项目级命令"
}
```

**POST /api/commands/load**
```json
{
  "commandPath": "string (required) - 命令文件路径（须在 .claude/commands 目录下）"
}
```

**POST /api/commands/execute**
```json
{
  "commandName": "string (required)",
  "commandPath": "string (自定义命令必填)",
  "args": ["string[] (optional)"],
  "context": {
    "projectPath": "string (optional)"
  }
}
```
