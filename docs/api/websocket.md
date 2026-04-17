# WebSocket 消息类型

> **最后更新**: 2026-04-17

WebSocket 连接通过 `GET /api/auth/ws-token` 获取令牌后建立。

---

## Chat 消息（AI 会话交互）

> 处理器: `backend/websocket/handlers/chat.js`

**客户端发送：**

| type | 说明 | 关键字段 |
|------|------|----------|
| `claude-command` | 执行 Claude SDK 命令 | `command`, `projectPath`, `sessionId`, `model`, `permissionMode` |
| `cursor-command` | 执行 Cursor 命令 | `command`, `projectPath`, `sessionId`, `model` |
| `codex-command` | 执行 Codex 命令 | `command`, `projectPath`, `sessionId`, `model` |
| `cursor-resume` | 恢复 Cursor 会话 | `sessionId`（向后兼容） |
| `abort-session` | 中止活跃会话 | `sessionId`, `provider`（支持 claude/cursor/codex） |
| `cursor-abort` | 中止 Cursor 会话 | `sessionId`（向后兼容） |
| `check-session-status` | 检查会话处理状态 | `sessionId` |
| `get-active-sessions` | 获取所有活跃会话 | — |

**服务端推送：**

| type | 说明 |
|------|------|
| `session-aborted` | 会话已中止确认 |
| `session-status` | 会话状态信息 |
| `active-sessions` | 活跃会话列表 |
| `error` | 错误信息 |

---

## Shell 消息（终端交互）

> 处理器: `backend/websocket/handlers/shell.js`

**客户端发送：**

| type | 说明 | 关键字段 |
|------|------|----------|
| `init` | 初始化终端会话 | — |
| `input` | 发送终端输入 | `data` |
| `resize` | 调整终端尺寸 | `cols`, `rows` |

**服务端推送：**

| type | 说明 |
|------|------|
| `output` | 终端输出数据 |
| `error` | 错误信息 |

---

## 会话消息类型

> 定义: `backend/services/core/types/message-types.js`

| 类型 | 值 | 说明 |
|------|------|------|
| `USER` | `user` | 用户消息 |
| `ASSISTANT` | `assistant` | AI 助手回复 |
| `SYSTEM` | `system` | 系统消息 |
| `SUMMARY` | `summary` | 摘要消息 |
| `TOOL_USE` | `tool_use` | 工具调用 |
| `TOOL_RESULT` | `tool_result` | 工具执行结果 |
| `ERROR` | `error` | 错误消息 |

---

## 消息状态

| 状态 | 值 | 说明 |
|------|------|------|
| `PENDING` | `pending` | 等待处理 |
| `PROCESSING` | `processing` | 处理中 |
| `COMPLETED` | `completed` | 已完成 |
| `FAILED` | `failed` | 失败 |
