# 多账户设置与 MCP 服务实现方案

> **文档版本**: 1.1
> **创建时间**: 2026-01-15
> **更新时间**: 2026-01-18
> **状态**: 已实施

## 1. 概述

本文档描述了多账户模式下 Claude Code 设置和 MCP 服务的技术实现方案。基于需求文档 `docs/requirement/multi-account-settings-and-mcp.md`，本方案涵盖数据库设计、API 设计、后端实现、前端实现和容器集成等各个方面。

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (Frontend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ ChatInterface │  │  Settings    │  │   MCP Management │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘     │
│         │                  │                   │                │
└─────────┼──────────────────┼───────────────────┼────────────────┘
          │                  │                   │
          │ WebSocket        │ HTTP API          │ HTTP API
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         后端 (Backend)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │    Router    │  │Settings API  │  │   MCP API        │     │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘     │
│         │                  │                   │                │
│  ┌──────▼──────────────────▼───────────────────▼─────────┐    │
│  │              Service Layer                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │    │
│  │  │ UserSettings│  │  MCPService │  │ScriptBuilder │  │    │
│  │  │   Service   │  │   Service   │  │              │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │    │
│  └─────────┼────────────────┼──────────────────┼──────────┘    │
│            │                │                  │                │
│  ┌─────────▼────────────────▼──────────────────▼─────────┐    │
│  │              Repository Layer                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │    │
│  │  │   User      │  │  MCP Server │  │  Container   │  │    │
│  │  │  Settings   │  │  Repository │  │   Manager    │  │    │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│            │                                                │
│  ┌─────────▼────────────────────────────────────────────────┐  │
│  │                    SQLite Database                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │
           │ Docker Exec
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker 容器 (Container)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ Claude SDK   │  │  MCP Client  │  │  File System     │     │
│  │  (with user  │  │  (per user)  │  │  /workspace      │     │
│  │   settings)  │  │              │  │                  │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户请求 → 前端界面 → API 调用 → 服务层 → 数据库
                                    ↓
                            容器管理器 → Docker 容器
                                    ↓
                            ScriptBuilder → SDK 脚本 → 执行
```

## 3. 数据库设计

### 3.1 用户设置表 (user_settings)

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'cursor', 'codex')),
  allowed_tools TEXT DEFAULT '[]',
  disallowed_tools TEXT DEFAULT '[]',
  skip_permissions BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_provider ON user_settings(provider);
```

**字段说明**：
- `allowed_tools`: JSON 字符串，存储允许的工具列表
- `disallowed_tools`: JSON 字符串，存储禁止的工具列表
- `skip_permissions`: 布尔值，默认 true（开启跳过权限提示）
- `UNIQUE(user_id, provider)`: 每个用户每个 provider 只能有一条记录

**默认工具定义**（在应用层）：
```javascript
const DEFAULT_CLAUDE_TOOLS = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch'
];
```

### 3.2 MCP 服务表 (user_mcp_servers)

```sql
CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('stdio', 'http', 'sse')),
  config TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_servers_user_id ON user_mcp_servers(user_id);
CREATE INDEX idx_mcp_servers_name ON user_mcp_servers(name);
```

**config 字段结构**（JSON）：
```json
{
  "command": "npx",
  "args": ["@upstash/context7-mcp"],
  "env": {
    "API_KEY": "xxx"
  }
}
```

或 http 类型：
```json
{
  "url": "https://api.example.com/mcp"
}
```

## 4. API 设计

### 4.1 用户设置 API

#### 4.1.1 获取用户设置

```
GET /api/users/settings/:provider
```

**请求参数**：
- `provider`: 'claude' | 'cursor' | 'codex'

**响应**：
```json
{
  "success": true,
  "settings": {
    "allowedTools": ["Write", "Read", ...],
    "disallowedTools": ["Bash(rm:*)"],
    "skipPermissions": true
  }
}
```

#### 4.1.2 更新用户设置

```
PUT /api/users/settings/:provider
```

**请求体**：
```json
{
  "allowedTools": ["Write", "Read"],
  "disallowedTools": [],
  "skipPermissions": true
}
```

**响应**：
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

#### 4.1.3 获取默认设置

```
GET /api/users/settings/:provider/defaults
```

**响应**：
```json
{
  "success": true,
  "defaults": {
    "allowedTools": ["Bash(git log:*)", ...],
    "disallowedTools": [],
    "skipPermissions": true
  }
}
```

### 4.2 MCP 服务 API

#### 4.2.1 获取 MCP 服务列表

```
GET /api/users/mcp-servers
```

**响应**：
```json
{
  "success": true,
  "servers": [
    {
      "id": 1,
      "name": "context7",
      "type": "stdio",
      "config": {...},
      "enabled": true,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### 4.2.2 创建 MCP 服务

```
POST /api/users/mcp-servers
```

**请求体**：
```json
{
  "name": "context7",
  "type": "stdio",
  "config": {
    "command": "npx",
    "args": ["@upstash/context7-mcp"],
    "env": {}
  }
}
```

**响应**：
```json
{
  "success": true,
  "server": {
    "id": 1,
    "name": "context7",
    ...
  }
}
```

#### 4.2.3 更新 MCP 服务

```
PUT /api/users/mcp-servers/:id
```

#### 4.2.4 删除 MCP 服务

```
DELETE /api/users/mcp-servers/:id
```

#### 4.2.5 测试 MCP 服务

```
POST /api/users/mcp-servers/:id/test
```

**响应**：
```json
{
  "success": true,
  "status": "connected",
  "message": "MCP server is responding",
  "tools": ["search", "query"]
}
```

#### 4.2.6 发现 MCP 工具

```
GET /api/users/mcp-servers/:id/tools
```

**响应**：
```json
{
  "success": true,
  "tools": [
    {
      "name": "search",
      "description": "Search the knowledge base",
      "inputSchema": {...}
    }
  ]
}
```

## 5. 后端实现

### 5.1 目录结构

**当前项目结构**：
```
backend/
├── database/
│   ├── migrations/
│   │   └── 005_add_user_settings_and_mcp.sql
│   ├── repositories/
│   │   ├── UserSettings.repository.js
│   │   └── McpServer.repository.js
│   ├── db.js
│   └── migrations.js
├── routes/
│   └── api/
│       ├── user-settings.js
│       └── mcp-servers.js
├── controllers/
│   └── api/
│       ├── UserSettingsController.js
│       └── McpServerController.js
├── services/
│   ├── settings/
│   │   └── UserSettingsService.js  # ✅ 已实施
│   └── mcp/
│       ├── McpService.js            # ✅ 已实施
│       └── McpContainerManager.js   # ✅ 已实施
└── shared/
    └── constants/
        └── defaultTools.js
```

### 5.2 Repository 层实现

#### 5.2.1 UserSettings.repository.js

```javascript
/**
 * UserSettings.repository.js
 *
 * 用户设置数据仓库
 */

import { db } from '../connection.js';

const DEFAULT_CLAUDE_TOOLS = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch'
];

export class UserSettings {
  /**
   * 获取用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Object|null} 用户设置对象
   */
  static async getByUserId(userId, provider) {
    const row = db.prepare(`
      SELECT * FROM user_settings
      WHERE user_id = ? AND provider = ?
    `).get(userId, provider);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      allowedTools: JSON.parse(row.allowed_tools || '[]'),
      disallowedTools: JSON.parse(row.disallowed_tools || '[]'),
      skipPermissions: row.skip_permissions === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 获取或创建默认设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Object} 用户设置对象
   */
  static async getOrCreateDefault(userId, provider) {
    let settings = await this.getByUserId(userId, provider);

    if (!settings) {
      const defaults = this.getDefaultSettings(provider);
      await this.create(userId, provider, defaults);
      settings = await this.getByUserId(userId, provider);
    }

    return settings;
  }

  /**
   * 创建用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Object} 创建的设置对象
   */
  static async create(userId, provider, data) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO user_settings (
        user_id, provider, allowed_tools, disallowed_tools,
        skip_permissions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      provider,
      JSON.stringify(data.allowedTools || []),
      JSON.stringify(data.disallowedTools || []),
      data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
      now,
      now
    );

    return this.getByUserId(userId, provider);
  }

  /**
   * 更新用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Object} 更新后的设置对象
   */
  static async update(userId, provider, data) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE user_settings
      SET allowed_tools = ?,
          disallowed_tools = ?,
          skip_permissions = ?,
          updated_at = ?
      WHERE user_id = ? AND provider = ?
    `);

    stmt.run(
      JSON.stringify(data.allowedTools || []),
      JSON.stringify(data.disallowedTools || []),
      data.skipPermissions !== undefined ? (data.skipPermissions ? 1 : 0) : 1,
      now,
      userId,
      provider
    );

    return this.getByUserId(userId, provider);
  }

  /**
   * 获取默认设置
   * @param {string} provider - Provider 名称
   * @returns {Object} 默认设置对象
   */
  static getDefaultSettings(provider) {
    return {
      allowedTools: provider === 'claude' ? [...DEFAULT_CLAUDE_TOOLS] : [],
      disallowedTools: [],
      skipPermissions: true
    };
  }
}

export default UserSettings;
```

#### 5.2.2 McpServer.repository.js

```javascript
/**
 * McpServer.repository.js
 *
 * MCP 服务器数据仓库
 */

import { db } from '../connection.js';

export class McpServer {
  /**
   * 获取用户的所有 MCP 服务器
   * @param {number} userId - 用户 ID
   * @returns {Array} MCP 服务器列表
   */
  static async getByUserId(userId) {
    const rows = db.prepare(`
      SELECT * FROM user_mcp_servers
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      config: JSON.parse(row.config),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * 根据 ID 获取 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @returns {Object|null} MCP 服务器对象
   */
  static async getById(id) {
    const row = db.prepare(`
      SELECT * FROM user_mcp_servers WHERE id = ?
    `).get(id);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      config: JSON.parse(row.config),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 创建 MCP 服务器
   * @param {number} userId - 用户 ID
   * @param {Object} data - MCP 服务器数据
   * @returns {Object} 创建的 MCP 服务器对象
   */
  static async create(userId, data) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO user_mcp_servers (
        user_id, name, type, config, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      data.name,
      data.type,
      JSON.stringify(data.config),
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
      now,
      now
    );

    return this.getById(this.lastInsertRowId());
  }

  /**
   * 更新 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {Object} data - 更新数据
   * @returns {Object} 更新后的 MCP 服务器对象
   */
  static async update(id, data) {
    const now = new Date().toISOString();

    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE user_mcp_servers
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.getById(id);
  }

  /**
   * 删除 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @returns {boolean} 是否成功
   */
  static async delete(id) {
    const stmt = db.prepare(`
      DELETE FROM user_mcp_servers WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 检查 MCP 服务器是否属于指定用户
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {boolean} 是否属于该用户
   */
  static async belongsToUser(id, userId) {
    const row = db.prepare(`
      SELECT 1 FROM user_mcp_servers
      WHERE id = ? AND user_id = ?
    `).get(id, userId);

    return !!row;
  }
}

export default McpServer;
```

### 5.3 Service 层实现

#### 5.3.1 UserSettingsService.js

```javascript
/**
 * UserSettingsService.js
 *
 * 用户设置服务
 */

import { UserSettings } from '../../database/repositories/UserSettings.repository.js';

export class UserSettingsService {
  /**
   * 获取用户设置，如果不存在则返回默认设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>} 用户设置
   */
  static async getSettings(userId, provider) {
    const settings = await UserSettings.getOrCreateDefault(userId, provider);
    return {
      allowedTools: settings.allowedTools,
      disallowedTools: settings.disallowedTools,
      skipPermissions: settings.skipPermissions
    };
  }

  /**
   * 更新用户设置
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @param {Object} data - 设置数据
   * @returns {Promise<Object>} 更新后的设置
   */
  static async updateSettings(userId, provider, data) {
    return await UserSettings.update(userId, provider, data);
  }

  /**
   * 获取默认设置
   * @param {string} provider - Provider 名称
   * @returns {Object} 默认设置
   */
  static getDefaults(provider) {
    return UserSettings.getDefaultSettings(provider);
  }

  /**
   * 获取用于 SDK 的配置对象
   * @param {number} userId - 用户 ID
   * @param {string} provider - Provider 名称
   * @returns {Promise<Object>} SDK 配置
   */
  static async getSdkConfig(userId, provider) {
    const settings = await this.getSettings(userId, provider);
    return {
      allowedTools: settings.allowedTools,
      disallowedTools: settings.disallowedTools,
      permissionMode: settings.skipPermissions ? 'bypassPermissions' : 'default'
    };
  }
}

export default UserSettingsService;
```

#### 5.3.2 McpService.js

```javascript
/**
 * McpService.js
 *
 * MCP 服务管理
 */

import { McpServer } from '../../database/repositories/McpServer.repository.js';
import { mcpIntegrationExpert } from '@constants/mcpIntegration.js';

export class McpService {
  /**
   * 获取用户的 MCP 服务器列表
   * @param {number} userId - 用户 ID
   * @returns {Promise<Array>} MCP 服务器列表
   */
  static async getServers(userId) {
    return await McpServer.getByUserId(userId);
  }

  /**
   * 创建 MCP 服务器
   * @param {number} userId - 用户 ID
   * @param {Object} data - MCP 服务器数据
   * @returns {Promise<Object>} 创建的 MCP 服务器
   */
  static async createServer(userId, data) {
    // 验证配置
    this.validateConfig(data);

    return await McpServer.create(userId, data);
  }

  /**
   * 更新 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>} 更新后的 MCP 服务器
   */
  static async updateServer(id, userId, data) {
    // 验证所有权
    const belongs = await McpServer.belongsToUser(id, userId);
    if (!belongs) {
      throw new Error('MCP server not found or access denied');
    }

    // 验证配置
    this.validateConfig(data);

    return await McpServer.update(id, data);
  }

  /**
   * 删除 MCP 服务器
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async deleteServer(id, userId) {
    const belongs = await McpServer.belongsToUser(id, userId);
    if (!belongs) {
      throw new Error('MCP server not found or access denied');
    }

    return await McpServer.delete(id);
  }

  /**
   * 测试 MCP 服务器连接
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 测试结果
   */
  static async testServer(id, userId) {
    const server = await McpServer.getById(id);
    if (!server || server.userId !== userId) {
      throw new Error('MCP server not found or access denied');
    }

    // TODO: 实现实际的连接测试
    return {
      success: true,
      status: 'connected',
      message: 'MCP server is responding'
    };
  }

  /**
   * 发现 MCP 服务器的工具
   * @param {number} id - MCP 服务器 ID
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 工具列表
   */
  static async discoverTools(id, userId) {
    const server = await McpServer.getById(id);
    if (!server || server.userId !== userId) {
      throw new Error('MCP server not found or access denied');
    }

    // TODO: 实现实际的工具发现
    return {
      success: true,
      tools: []
    };
  }

  /**
   * 验证 MCP 配置
   * @param {Object} data - 配置数据
   * @throws {Error} 配置无效时抛出错误
   */
  static validateConfig(data) {
    if (!data.name || data.name.trim() === '') {
      throw new Error('MCP server name is required');
    }

    if (!['stdio', 'http', 'sse'].includes(data.type)) {
      throw new Error('Invalid MCP server type');
    }

    if (!data.config || typeof data.config !== 'object') {
      throw new Error('MCP server config is required');
    }

    // 根据类型验证配置
    if (data.type === 'stdio') {
      if (!data.config.command) {
        throw new Error('stdio type requires command');
      }
    } else if (data.type === 'http' || data.type === 'sse') {
      if (!data.config.url) {
        throw new Error('http/sse type requires url');
      }
    }
  }
}

export default McpService;
```

### 5.4 容器集成

#### 5.4.1 更新 ScriptBuilder.js

修改 `backend/services/container/claude/ScriptBuilder.js`，使其从用户设置中读取配置：

```javascript
import { UserSettingsService } from '../../settings/UserSettingsService.js';
import { McpContainerManager } from '../../mcp/McpContainerManager.js';

export function buildSDKScript(command, options) {
  const sessionId = options.sessionId || '';

  // 从用户设置中读取配置
  const sdkConfig = await UserSettingsService.getSdkConfig(
    options.userId,
    'claude'
  );

  // 合并用户配置和传入的 options
  const finalOptions = {
    ...options,
    allowedTools: sdkConfig.allowedTools,
    disallowedTools: sdkConfig.disallowedTools,
    permissionMode: sdkConfig.permissionMode
  };

  // 获取用户的 MCP 配置
  const mcpServers = await McpContainerManager.getUserMcpConfig(options.userId);

  const sdkOptions = filterSDKOptions(finalOptions);

  // 添加 MCP 服务器配置
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    sdkOptions.mcpServers = mcpServers;
  }

  // ... 其余脚本生成代码
}
```

#### 5.4.2 McpContainerManager.js

```javascript
/**
 * McpContainerManager.js
 *
 * MCP 容器管理器
 * 负责 MCP 服务在容器内的配置和管理
 */

import { McpServer } from '../../database/repositories/McpServer.repository.js';

export class McpContainerManager {
  /**
   * 获取用户的 MCP 配置，用于传递给 SDK
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} MCP 服务器配置对象
   */
  static async getUserMcpConfig(userId) {
    const servers = await McpServer.getByUserId(userId);
    const config = {};

    for (const server of servers) {
      if (!server.enabled) continue;

      config[server.name] = {
        type: server.type,
        ...(server.type === 'stdio' ? {
          command: server.config.command,
          args: server.config.args || [],
          env: server.config.env || {}
        } : {
          url: server.config.url
        })
      };
    }

    return config;
  }

  /**
   * 为容器准备 MCP 环境变量
   * @param {number} userId - 用户 ID
   * @returns {Promise<Object>} 环境变量对象
   */
  static async getMcpEnvVars(userId) {
    const servers = await McpServer.getByUserId(userId);
    const envVars = {};

    // 将 MCP 配置通过环境变量传递
    envVars.MCP_SERVERS = JSON.stringify(
      servers.filter(s => s.enabled).map(s => ({
        name: s.name,
        type: s.type,
        config: s.config
      }))
    );

    return envVars;
  }
}

export default McpContainerManager;
```

## 6. 前端实现

### 6.1 API 请求函数

```javascript
// frontend/utils/api.js

// 用户设置 API
export const userSettingsApi = {
  // 获取设置
  async getSettings(provider) {
    const response = await authenticatedFetch(
      `/api/users/settings/${provider}`
    );
    return response.json();
  },

  // 更新设置
  async updateSettings(provider, settings) {
    const response = await authenticatedFetch(
      `/api/users/settings/${provider}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }
    );
    return response.json();
  },

  // 获取默认设置
  async getDefaults(provider) {
    const response = await authenticatedFetch(
      `/api/users/settings/${provider}/defaults`
    );
    return response.json();
  }
};

// MCP 服务 API
export const mcpApi = {
  // 获取 MCP 服务列表
  async getServers() {
    const response = await authenticatedFetch('/api/users/mcp-servers');
    return response.json();
  },

  // 创建 MCP 服务
  async createServer(data) {
    const response = await authenticatedFetch('/api/users/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  // 更新 MCP 服务
  async updateServer(id, data) {
    const response = await authenticatedFetch(`/api/users/mcp-servers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  // 删除 MCP 服务
  async deleteServer(id) {
    const response = await authenticatedFetch(`/api/users/mcp-servers/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // 测试 MCP 服务
  async testServer(id) {
    const response = await authenticatedFetch(`/api/users/mcp-servers/${id}/test`, {
      method: 'POST'
    });
    return response.json();
  },

  // 发现工具
  async discoverTools(id) {
    const response = await authenticatedFetch(`/api/users/mcp-servers/${id}/tools`);
    return response.json();
  }
};
```

### 6.2 Settings 组件修改

```javascript
// frontend/components/Settings.jsx

// 修改加载函数，从 API 加载而非 localStorage
const loadSettings = async () => {
  try {
    // 从 API 加载 Claude 设置
    const claudeResponse = await userSettingsApi.getSettings('claude');
    if (claudeResponse.success) {
      setAllowedTools(claudeResponse.settings.allowedTools);
      setDisallowedTools(claudeResponse.settings.disallowedTools);
      setSkipPermissions(claudeResponse.settings.skipPermissions);
    } else {
      // 使用默认设置
      const defaults = await userSettingsApi.getDefaults('claude');
      setAllowedTools(defaults.defaults.allowedTools);
      setSkipPermissions(defaults.defaults.skipPermissions);
    }

    // 加载 MCP 服务
    await fetchMcpServers();
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

// 修改保存函数，保存到 API 而非 localStorage
const handleSaveSettings = async () => {
  setIsSaving(true);
  setSaveStatus(null);

  try {
    await userSettingsApi.updateSettings('claude', {
      allowedTools,
      disallowedTools,
      skipPermissions
    });

    setSaveStatus('success');
  } catch (error) {
    console.error('Error saving settings:', error);
    setSaveStatus('error');
  } finally {
    setIsSaving(false);
  }
};
```

## 7. 数据迁移

### 7.1 迁移脚本

```sql
-- backend/database/migrations/005_add_user_settings_and_mcp.sql

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('claude', 'cursor', 'codex')),
  allowed_tools TEXT DEFAULT '[]',
  disallowed_tools TEXT DEFAULT '[]',
  skip_permissions BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_provider ON user_settings(provider);

-- MCP 服务器表
CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('stdio', 'http', 'sse')),
  config TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON user_mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON user_mcp_servers(name);

-- 为现有用户创建默认设置
INSERT OR IGNORE INTO user_settings (user_id, provider, allowed_tools, disallowed_tools, skip_permissions)
SELECT id, 'claude', '[]', '[]', 1 FROM users;
```

## 8. 实现顺序

### 阶段 1：数据库和 Repository（优先级：高）

1. 创建数据库迁移脚本
2. 实现 `UserSettings.repository.js`
3. 实现 `McpServer.repository.js`
4. 编写单元测试

### 阶段 2：Service 层（优先级：高）

1. 实现 `UserSettingsService.js`
2. 实现 `McpService.js`
3. 实现 `McpContainerManager.js`
4. 编写单元测试

### 阶段 3：API 层（优先级：高）

1. 创建 `routes/api/user-settings.js`
2. 创建 `routes/api/mcp-servers.js`
3. 创建对应的 Controller
4. 集成认证中间件

### 阶段 4：容器集成（优先级：高）

1. 修改 `ScriptBuilder.js` 以使用用户设置
2. 实现 MCP 配置传递到容器
3. 测试容器内设置生效

### 阶段 5：前端改造（优先级：中）

1. 创建 API 请求函数
2. 修改 Settings 组件使用 API
3. 移除 localStorage 相关代码
4. 添加加载状态和错误处理

### 阶段 6：MCP 测试和工具发现（优先级：中）

1. 实现 MCP 连接测试
2. 实现工具发现功能
3. 添加 UI 反馈

### 阶段 7：测试和优化（优先级：低）

1. 端到端测试
2. 性能优化
3. 文档完善

## 9. 测试计划

### 9.1 单元测试

- Repository 层测试
- Service 层测试
- API 测试

### 9.2 集成测试

- 容器集成测试
- MCP 服务集成测试

### 9.3 端到端测试

- 用户设置保存和加载
- MCP 服务创建和使用
- 容器内设置生效验证

## 10. 回滚计划

如果新实现出现问题，可以：

1. 保留原有 localStorage 方式作为 fallback
2. 使用特性开关控制新旧实现
3. 数据迁移失败时的回滚机制

## 11. 附录

### 11.1 默认工具完整列表

```javascript
const DEFAULT_CLAUDE_TOOLS = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch'
];
```

### 11.2 MCP 配置示例

**stdio 类型**：
```json
{
  "name": "context7",
  "type": "stdio",
  "config": {
    "command": "npx",
    "args": ["@upstash/context7-mcp"],
    "env": {
      "CONTEXT7_API_KEY": "your-api-key"
    }
  }
}
```

**http 类型**：
```json
{
  "name": "custom-api",
  "type": "http",
  "config": {
    "url": "https://api.example.com/mcp"
  }
}
```

### 11.3 API 端点汇总

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users/settings/:provider` | 获取用户设置 |
| PUT | `/api/users/settings/:provider` | 更新用户设置 |
| GET | `/api/users/settings/:provider/defaults` | 获取默认设置 |
| GET | `/api/users/mcp-servers` | 获取 MCP 服务列表 |
| POST | `/api/users/mcp-servers` | 创建 MCP 服务 |
| PUT | `/api/users/mcp-servers/:id` | 更新 MCP 服务 |
| DELETE | `/api/users/mcp-servers/:id` | 删除 MCP 服务 |
| POST | `/api/users/mcp-servers/:id/test` | 测试 MCP 服务 |
| GET | `/api/users/mcp-servers/:id/tools` | 发现 MCP 工具 |

### 11.4 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数无效 |
| 401 | 未授权 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重名） |
| 500 | 服务器错误 |

---

## 文档维护

本文档应该根据实际实施情况持续更新。如有任何疑问或建议，请联系项目维护者。

**版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-15 | Claude | 初始版本 |
| 1.1 | 2026-01-18 | Claude | 更新项目结构和实施状态 |
