# Claude Code UI - 流式输出架构

> **文档版本**: 1.0
> **创建时间**: 2026-06-09
> **最后更新**: 2026-06-09
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、流式输出总览](#一流式输出总览)
- [二、端到端数据流](#二端到端数据流)
- [三、后端流处理管道](#三后端流处理管道)
- [四、前端消息处理链](#四前端消息处理链)
- [五、流式缓冲与渲染](#五流式缓冲与渲染)
- [六、多提供商对比](#六多提供商对比)
- [七、WebSocket 消息类型目录](#七websocket-消息类型目录)

---

## 一、流式输出总览

系统支持三种 AI 提供商的流式输出，统一通过 WebSocket 传输到前端：

```
┌──────────────────────────────────────────────────────────────┐
│                        用户浏览器                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  useMessageStream (100ms 节流缓冲)                    │    │
│  │       ↕                                               │    │
│  │  websocketHandler → claudeMessageHandlers             │    │
│  │       ↕                                               │    │
│  │  useWebSocket ←──────────── WebSocket /ws             │    │
│  └───────────────────────┬───────────────────────────────┘    │
└──────────────────────────┼────────────────────────────────────┘
                           │ ws.send(JSON)
┌──────────────────────────┼────────────────────────────────────┐
│                    后端 Express                               │
│  ┌───────────────────────▼───────────────────────────────┐    │
│  │  chat.js → ClaudeQuery → DockerExecutor                │    │
│  │       │                                                │    │
│  │       ├── Claude  → Docker 容器内 SDK 脚本 (stdout)    │    │
│  │       ├── Codex   → 宿主机 Codex SDK (async iterable)  │    │
│  │       └── Cursor  → 宿主机 cursor-agent 进程 (stdout)  │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、端到端数据流

以 Claude 提供商为例，完整的流式数据流（13 步）：

```
 [1] 用户输入
      │
      ▼
 [2] useMessageSender.sendWebSocketMessage()
      │  → WebSocket: { type: "claude-command", command, options }
      ▼
 [3] chat.js COMMAND_HANDLERS["claude-command"]
      │  → handleClaudeCommand()
      ▼
 [4] ClaudeQuery.queryClaudeSDKInContainer()
      │  → containerManager.getOrCreateContainer()
      ▼
 [5] ScriptBuilder.buildSDKScript()
      │  → filterSDKOptions() 6步管道 → generateSDKScript()
      ▼
 [6] DockerExecutor.executeInContainer()
      │  → 写入脚本到容器 /tmp/ → exec: node sdk_exec_xxx.mjs
      ▼
 [7] 容器内 SDK 脚本执行
      │  for await (const chunk of query({ prompt, options })) {
      │    console.log(JSON.stringify({ type: "content", chunk }));
      │  }
      ▼
 [8] docker.modem.demuxStream(stream, stdout, stderr)
      │  → 8字节协议头分离 stdout/stderr
      ▼
 [9] dockerStreamHandler → MessageTransformer.processOutput()
      │  → JSON 行解析 → 按 type 路由
      ▼
[10] sdkMessageHandlers.handleSdkMessage()
      │  → assistant / result / default 分发
      ▼
[11] WebSocketWriter.send({ type: "claude-response", data })
      │  → ws.send(JSON.stringify(data))
      ▼
[12] 前端 websocketHandler → claudeHandler → claudeMessageHandlers
      │  → dispatchClaudeResponse() 5步优先链
      ▼
[13] useMessageStream.updateStreamContent()
       → 100ms 节流缓冲 → React 重渲染 → StreamingIndicator
```

---

## 三、后端流处理管道

### 3.1 容器内脚本 → stdout

**文件**: `backend/services/container/claude/templates/sdkScriptTemplate.js`

容器内运行的 Node.js 脚本通过 stdout 输出 JSON 行协议：

| 输出类型 | 说明 |
|---------|------|
| `{ type: "content", chunk }` | SDK 消息（assistant/result/user 等） |
| `{ type: "done", sessionId }` | 执行完成 |
| `{ type: "error", error }` | 执行错误 |
| `{ type: "agent-question", toolUseID, questions }` | Agent 向用户提问 |

### 3.2 Docker 流多路分离

**文件**: `backend/services/container/claude/DockerExecutor.js`

```
Docker exec stream
  │
  ▼
docker.modem.demuxStream(stream, stdout, stderr)
  │                          │           │
  ▼                          ▼           ▼
stdout (type=1)          stderr (type=2)
  │                          │
  ▼                          ▼
PassThrough              PassThrough
  │                          │
  ▼                          ▼
MessageTransformer       错误检测 + SDK 日志
  │
  ▼
JSON 行解析 → 类型路由
```

### 3.3 消息路由

**文件**: `backend/services/container/claude/MessageTransformer.js` + `sdkMessageHandlers.js`

```
stdout JSON 行
  │
  ├── type: "content" ──→ handleSdkMessage(chunk)
  │                         ├── assistant → handleAssistantMessage()
  │                         │     → writer.send("claude-response")
  │                         │     → API 错误检测(503/429) → writer.send("claude-error")
  │                         │     → Write/Bash 工具检测 → writer.send("document-created")
  │                         ├── result → handleResultMessage()
  │                         │     → writer.send("token-budget") / writer.send("claude-error")
  │                         └── default → handleDefaultMessage()
  │                               → writer.send("claude-response")
  │
  ├── type: "done" ──────────→ writer.send("claude-complete")
  ├── type: "error" ─────────→ writer.send("claude-error")
  ├── type: "agent-question" → writer.send("agent-question")
  └── type: "agent-question-auto-answered" → 仅日志（bypass 模式审计）
```

---

## 四、前端消息处理链

**文件**: `frontend/features/chat/services/`

```
WebSocket onmessage
  │
  ▼
useWebSocket.ts → messages 数组
  │
  ▼
useChatWebSocketProcessor.ts → handleWebSocketMessage()
  │
  ▼
websocketHandler.ts → MESSAGE_HANDLERS 查找表（20+ 类型）
  │
  ├── "claude-response" → claudeHandler → dispatchClaudeResponse()
  │     │
  │     ▼ 5 步优先链（首匹配即返回）:
  │     ① handleStreamingDelta()     ← content_block_delta / content_block_stop
  │     ② handleAssistantContent()  ← assistant 消息（文本块 + 工具调用块）
  │     ③ handleThinkingMessage()   ← thinking 消息
  │     ④ handleResultMessage()     ← result 最终结果
  │     ⑤ handleUserMessage()       ← user 消息回显
  │
  ├── "claude-complete" → sessionHandler → onSetLoading(false), completeStream()
  ├── "claude-error"    → claudeHandler  → onSetLoading(false), completeStream(), 添加错误消息
  ├── "agent-question"  → claudeHandler  → setPendingQuestion(), 渲染问题文本
  ├── "token-budget"    → sessionHandler → 更新 token 用量 UI
  ├── "session-created" → sessionHandler → 更新真实 session ID
  └── "document-created" → 触发右侧文档面板刷新
```

---

## 五、流式缓冲与渲染

**文件**: `frontend/features/chat/hooks/useMessageStream.ts`

双缓冲区 + 100ms 节流机制，避免高频 WebSocket 消息导致 React 过度渲染：

```
SDK delta 事件高频到达（每秒数十次）
  │
  ▼
streamBufferRef += delta        ← 追加到 ref 缓冲区（无渲染）
  │
  ... 100ms 节流定时器 ...
  │
  ▼
flushBuffer()                   ← 合并缓冲区 → setState 触发渲染
  │
  ▼
streamingContent state 更新 → StreamingIndicator 渲染
  │
  ▼
completeStream()                ← 最终 flush + isStreaming=false
  │
  ▼
onStreamComplete 回调 → 添加完整 assistant 消息到消息列表
```

**渲染组件层级**：

```
ChatInterfaceRenderer
  └── ChatInterfaceMainArea
        ├── ChatMessageList         ← 历史消息（含 isStreaming 消息）
        ├── ThinkingProcess         ← 思考过程（<details> 折叠）
        └── StreamingIndicator      ← 蓝色弹跳点 + 内容预览
```

---

## 六、多提供商对比

| 维度 | Claude | Codex | Cursor |
|------|--------|-------|--------|
| **执行方式** | Docker 容器内 SDK | 宿主机 Codex SDK | 宿主机 cursor-agent 进程 |
| **流来源** | 容器 stdout JSON 行 | SDK async iterable | child_process stdout |
| **流式 Delta** | ✅ content_block_delta | ❌ 整条消息 | ❌ 整条消息 |
| **交互问答** | ✅ stdin/stdout 双向通信 | ❌ | ❌ |
| **消息前缀** | `claude-` | `codex-` | `cursor-` |
| **核心文件** | `ClaudeQuery.js` → `DockerExecutor.js` | `CodexExecutor.js` | `cursor/index.js` |

---

## 七、WebSocket 消息类型目录

### 后端 → 前端

| 消息类型 | 来源 | 说明 |
|---------|------|------|
| `session-start` | ClaudeQuery | 会话启动通知 |
| `session-created` | sdkMessageHandlers | SDK 返回真实 session ID |
| `claude-response` | sdkMessageHandlers | SDK 消息（assistant/result/default） |
| `claude-complete` | MessageTransformer | 会话执行完成 |
| `claude-error` | sdkMessageHandlers | 执行错误或 API 代理错误 |
| `agent-question` | MessageTransformer | Agent 交互提问 |
| `token-budget` | sdkMessageHandlers | Token 用量更新 |
| `document-created` | sdkMessageHandlers | AI 生成了文件 |
| `codex-response` | CodexExecutor | Codex SDK 事件 |
| `codex-complete` | CodexExecutor | Codex 会话完成 |
| `cursor-system/tool-use/error/result/output` | cursor/index.js | Cursor 各类事件 |
| `session-aborted` | chat.js | 会话被中止 |

### 前端 → 后端

| 消息类型 | 来源 | 说明 |
|---------|------|------|
| `claude-command` | useMessageSender | 发送消息给 Claude（含 permissionMode） |
| `codex-command` | useMessageSender | 发送消息给 Codex |
| `cursor-command` | useMessageSender | 发送消息给 Cursor |
| `user-answer` | useChatInterface | 回答 Agent 提问 |
| `abort-session` | useChatInterface | 中止当前会话 |
| `check-session-status` | useChatInterface | 查询会话状态 |

---

## 八、一些笔记
### 1. 一句话

▎ 系统把 AI SDK 的流式输出，通过 Docker 容器 stdout → 后端消息路由 → WebSocket → 前端双缓冲渲染 这条管道，实时送到用户屏幕上。

### 2. 核心架构（3 层）

容器内 SDK 脚本    →  后端 Express 消息路由  →  前端 React 渲染
(JSON 行写 stdout)    (JSON 解析 + 类型分发)     (100ms 节流缓冲)

关键文件各一个：
- 容器层：DockerExecutor.js — 负责 Docker 流的 demux 分离
- 路由层：MessageTransformer.js + sdkMessageHandlers.js — JSON 行解析 + 按类型路由
- 前端层：websocketHandler.ts → claudeMessageHandlers → useMessageStream.ts

### 3. 一些问题

┌────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│            问题            │                                                            答案                                                             │
├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 流是怎么从容器出来的？     │ 容器内 SDK 脚本把每个 chunk 以 JSON 行打到 stdout；后端用 docker.modem.demuxStream 做 8 字节协议头分离，区分 stdout/stderr  │
├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 消息在前端怎么避免卡顿？   │ useMessageStream 用双缓冲区 + 100ms 节流：delta 先追加到 ref（不触发渲染），定时器每 100ms 才 flush 到 state 一次           │
├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 三种 AI 提供商有什么区别？ │ Claude 在 Docker 容器内跑（流式 delta）；Codex/Cursor 在宿主机跑（整条消息返回）。消息前缀分别是 claude- / codex- / cursor- │
├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 支持 Agent 交互提问吗？    │ 只有 Claude 支持：容器内发 agent-question，前端渲染问题 UI，用户回答后通过 stdin 回传容器                                   │
└────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

### 4. 消息类型速查

如果需要做前端开发，重点记住这几个：

- claude-response — 主数据流（assistant 消息、thinking、result）
- claude-complete — 流结束信号
- claude-error — 错误（含 API 503/429 代理错误）
- agent-question — Agent 提问
- document-created — AI 生成了文件（触发右侧面板刷新）
- token-budget — token 用量更新


## 相关文档

- [架构概述](./architecture-overview.md)
- [权限控制架构](./permission-control-architecture.md)
- [核心模块设计](./core-modules-design.md)
- [设计模式](./design-patterns.md)

---

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|---------|
| 1.0 | 2026-06-09 | Claude | 初版：流式输出端到端架构 |
