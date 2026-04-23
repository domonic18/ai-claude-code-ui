# Agent 交互提问（AskUserQuestion）交互方案

> **状态**：方案讨论中
> **日期**：2026-04-23
> **范围**：前端渲染 + 后端消息协议 + 容器 SDK 回调

---

## 1. 现状分析

### 1.1 当前流程

```
Agent 调用 AskUserQuestion
    → SDK canUseTool 回调拦截
    → 容器 stdout 输出 { type: "agent-question", toolUseID, questions, prompt }
    → 后端 WebSocket 转发到前端
    → 前端 handleAgentQuestion() 处理：
        1. 设置 isLoading = false
        2. 将结构化数据转为纯文本，作为 assistant 消息渲染
        3. 设置 pendingQuestion = { toolUseID, sessionId }
    → 用户在输入框输入文字 → consumePendingQuestion() 截获
    → 发送 { type: "user-answer", toolUseID, answer } 到后端
    → 后端写入容器 stdin → SDK Promise resolve → Agent 继续执行
```

### 1.2 存在的问题

| # | 问题 | 影响 | 严重程度 |
|---|------|------|----------|
| 1 | **结构化数据丢失**：`handleAgentQuestion` 将 `questions`（含选项 `options`）转为纯文本，前端无法渲染可点击按钮 | 用户必须手动输入选项文本 | 高 |
| 2 | **用户被困住**：`pendingQuestion` 设置后，所有用户输入都作为回答发送，无法取消或做其他操作 | 用户只能回答，无法退出 | 高 |
| 3 | **停止按钮不可见**：`handleAgentQuestion` 设置 `isLoading = false`，而 ChatToolbar 的停止按钮仅在 `isLoading && ws` 时显示 | 用户看不到取消按钮 | 高 |
| 4 | **无 deny 机制**：后端只有 `user-answer` 和 `abort-session`，没有"拒绝当前问题但继续会话"的中间态 | 取消 = 杀死整个会话 | 中 |
| 5 | **无输入提示**：pending 状态下输入框无任何视觉差异，用户不知道当前处于"回答模式" | 用户体验差 | 低 |

### 1.3 Claude Code CLI 的做法（参考）

Claude Code CLI 处理 `AskUserQuestion` 的方式：

| 行为 | CLI 实现 | 我们的差距 |
|------|---------|-----------|
| 选项 + 自由输入共存 | 渲染可选择的选项按钮，也支持自由文本输入 | 当前仅支持自由文本 |
| 取消当前提问（deny） | `Ctrl+C` → 发送 `{behavior: 'deny'}`，Agent 收到拒绝后可继续其他操作 | 无此机制 |
| 终止会话（abort） | 连按两次 `Ctrl+C` 或 `Ctrl+D` → 终止整个会话 | 已有 `abort-session` |
| 旁聊（/btw） | `/btw` 前缀可在 pending 状态下发送新命令 | 暂不实现 |
| 回退（rewind） | `Esc Esc` 恢复到上一个检查点 | 暂不实现 |

---

## 2. 目标

**只实现最基础的 Agent 交互功能**，与 Claude Code CLI 保持一致：

1. **可点击的选项按钮**：结构化渲染 AskUserQuestion 的选项，点击即回答
2. **自由文本输入**：保留现有能力，用户仍可手动输入答案
3. **取消当前提问**（deny）：拒绝当前问题，Agent 收到后可选择其他路径
4. **终止会话**（abort）：保持现有行为不变
5. **Pending 状态可见**：在 pending 状态下显示取消按钮和输入提示

**明确不实现**（后续迭代）：

- `/btw` 旁聊功能
- rewind / checkpoint 回退机制

---

## 3. 交互方案设计

### 3.1 消息渲染

#### 3.1.1 交互提问消息的 UI 结构

当 Agent 发送带有 `options` 的 AskUserQuestion 时，消息渲染为：

```
┌──────────────────────────────────────────────────┐
│  🤖 Claude                                       │
│ ┌──────────────────────────────────────────────┐ │
│ │ Agent 提问文本（prompt + question）            │ │
│ │                                              │ │
│ │ ┌─────────────────────────────────────────┐  │ │
│ │ │  选项 A 描述文字                          │  │ │
│ │ └─────────────────────────────────────────┘  │ │
│ │ ┌─────────────────────────────────────────┐  │ │
│ │ │  选项 B 描述文字                          │  │ │
│ │ └─────────────────────────────────────────┘  │ │
│ │ ┌─────────────────────────────────────────┐  │ │
│ │ │  选项 C 描述文字                          │  │ │
│ │ └─────────────────────────────────────────┘  │ │
│ │                                              │ │
│ │ 💬 或在下方输入框中输入自定义回答              │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

#### 3.1.2 无选项的提问

如果 AskUserQuestion 没有提供 `options`，则按当前方式渲染为纯文本，用户在输入框中自由输入。

#### 3.1.3 已回答状态

用户回答后，该消息进入 `isAnswered` 状态：
- 选项按钮变为 disabled
- 显示用户选择的答案（高亮选项或显示输入的文本）

### 3.2 工具栏状态

#### 3.2.1 正常加载状态（isLoading = true）

```
┌──────────────────────────────────────────────────┐
│  [权限模式] [模型选择器] [Token饼图]  [■ 停止]     │
└──────────────────────────────────────────────────┘
```

保持现有行为不变。

#### 3.2.2 Pending 提问状态（isLoading = false, pendingQuestion ≠ null）

```
┌──────────────────────────────────────────────────┐
│  [权限模式] [模型选择器] [Token饼图]  [✕ 取消提问]  │
└──────────────────────────────────────────────────┘
```

- 显示"取消提问"按钮（而非"停止"按钮）
- 点击后发送 `deny-question` 消息（deny，非 abort）
- 按钮样式：橙色/黄色，区别于红色的"停止"按钮

### 3.3 输入框状态

#### 3.3.1 Pending 状态下的输入框

```
┌──────────────────────────────────────────────────┐
│  输入回答...                                       │
│  [📎] [                               ] [发送 ➤]  │
└──────────────────────────────────────────────────┘
```

- placeholder 变为"输入回答..."
- 输入框上方或内部显示一个小提示条：`"正在回答 Agent 的提问"`

### 3.4 用户操作矩阵

| 状态 | 点击选项按钮 | 输入文本 + 发送 | 点击"取消提问" | 点击"停止" |
|------|-------------|----------------|--------------|-----------|
| isLoading | 不可见 | 禁用 | 不可见 | 发送 abort-session |
| pending（有选项） | 发送 user-answer | 发送 user-answer | 发送 deny-question | 不可见 |
| pending（无选项） | 不可见 | 发送 user-answer | 发送 deny-question | 不可见 |
| 空闲 | 不可见 | 发送 claude-command | 不可见 | 不可见 |

---

## 4. 数据流设计

### 4.1 新增 WebSocket 消息类型：`deny-question`

```json
{
  "type": "deny-question",
  "sessionId": "session-xxx",
  "toolUseID": "toolu_xxx"
}
```

**语义**：用户拒绝回答当前问题，Agent 应收到 `{behavior: 'deny'}`，可以尝试其他路径或继续执行。

**与 `abort-session` 的区别**：
- `deny-question`：拒绝单个工具调用，Agent 仍活着，可以继续对话
- `abort-session`：杀死整个 Docker exec 进程，会话终止

### 4.2 容器 stdin 协议扩展

当前 stdin 仅处理 `user-answer` 类型：

```json
{ "type": "user-answer", "toolUseID": "toolu_xxx", "answer": "用户回答" }
```

新增 `deny-answer` 类型：

```json
{ "type": "deny-answer", "toolUseID": "toolu_xxx" }
```

SDK `canUseTool` 回调中，收到 `deny-answer` 时 resolve 为 `{behavior: 'deny'}`：

```javascript
// canUseToolTemplate.js 中的修改
pendingAnswers.set(toolUseID, (answer, denied) => {
  if (denied) {
    resolve({ behavior: 'deny', toolUseID: toolUseID });
  } else {
    resolve({
      behavior: 'allow',
      updatedInput: { ...input, answer: answer },
      toolUseID: toolUseID
    });
  }
});
```

### 4.3 前端消息结构变更

`handleAgentQuestion` 中 `onAddMessage` 的消息对象增加 `interactiveQuestion` 字段：

```typescript
{
  id: 'assistant-xxx',
  type: 'assistant',
  content: '纯文本回退内容（现有逻辑不变）',
  timestamp: Date.now(),
  interactiveQuestion: {           // 新增
    toolUseID: 'toolu_xxx',
    questions: [
      {
        question: '你想使用哪种方案？',
        options: [
          { label: '方案 A', description: '使用 REST API' },
          { label: '方案 B', description: '使用 GraphQL' },
        ]
      }
    ],
    prompt: '请选择一个方案'
  }
}
```

**注意**：`ChatMessage` 类型定义中已有 `interactiveQuestion` 字段（`chat.types.ts:57-72`），无需修改类型。

### 4.4 完整数据流

```
                        ┌─────────────────────────────────┐
                        │         Agent (SDK)              │
                        │  调用 AskUserQuestion 工具       │
                        └──────────┬──────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────────────────┐
                        │     canUseTool 回调拦截          │
                        │  stdout: { agent-question,       │
                        │    toolUseID, questions, prompt }│
                        └──────────┬──────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────────────────┐
                        │      后端 WebSocket 转发         │
                        └──────────┬──────────────────────┘
                                   │
                                   ▼
                  ┌────────────────────────────────────────┐
                  │         前端 handleAgentQuestion       │
                  │                                        │
                  │  1. isLoading = false                  │
                  │  2. 添加 assistant 消息                │
                  │     + interactiveQuestion 结构化数据   │
                  │  3. pendingQuestion = { toolUseID,     │
                  │     sessionId }                        │
                  └────────────┬───────────────────────────┘
                               │
                ┌──────────────┼──────────────────┐
                │              │                  │
                ▼              ▼                  ▼
         ┌──────────┐  ┌───────────┐    ┌───────────────┐
         │ 点击选项  │  │ 输入文本   │    │ 点击"取消提问"│
         │ 按钮     │  │ + 发送     │    │               │
         └─────┬────┘  └─────┬─────┘    └───────┬───────┘
               │             │                  │
               ▼             ▼                  ▼
         ┌──────────────────────────┐  ┌─────────────────┐
         │ WebSocket: user-answer   │  │ WebSocket:       │
         │ { toolUseID, answer }    │  │ deny-question    │
         └────────────┬─────────────┘  │ { toolUseID }   │
                      │                └────────┬────────┘
                      ▼                         │
         ┌──────────────────────────┐           │
         │ 后端 → 容器 stdin         │           ▼
         │ { user-answer, ... }     │  ┌──────────────────┐
         └────────────┬─────────────┘  │ 后端 → 容器 stdin │
                      │                │ { deny-answer }   │
                      ▼                └────────┬─────────┘
         ┌──────────────────────────┐           │
         │ SDK canUseTool resolve   │           ▼
         │ { behavior: 'allow',     │  ┌───────────────────┐
         │   updatedInput: {...} }  │  │ SDK canUseTool     │
         └────────────┬─────────────┘  │ resolve            │
                      │                │ { behavior: 'deny'}│
                      ▼                └────────┬──────────┘
               ┌──────────────┐                 │
               │ Agent 继续    │                 ▼
               │ 正常执行      │        ┌─────────────────┐
               └──────────────┘        │ Agent 收到 deny  │
                                       │ 可选择其他路径    │
                                       └─────────────────┘
```

---

## 5. 需要修改的文件

### 5.1 前端

| 文件 | 修改内容 |
|------|---------|
| `frontend/features/chat/services/claudeHandler.ts` | `handleAgentQuestion()`：消息对象增加 `interactiveQuestion` 字段 |
| `frontend/features/chat/components/ToolContentRenderer.tsx` | `renderToolContent()`：检测 `message.interactiveQuestion`，渲染 `InteractiveQuestion` 组件 |
| **新建** `frontend/features/chat/components/InteractiveQuestion.tsx` | 可点击选项按钮组件：渲染选项列表、处理点击/禁用状态 |
| `frontend/features/chat/components/ChatToolbar.tsx` | 新增 `hasPendingQuestion` prop，显示"取消提问"按钮 |
| `frontend/features/chat/components/ChatInterfaceInputArea.tsx` | 传递 `hasPendingQuestion` 到 ChatToolbar |
| `frontend/features/chat/components/ChatInterfaceRenderer.tsx` | 从 hook 取 `pendingQuestion` 状态，向下传递 |
| `frontend/features/chat/hooks/useChatInterface.ts` | 导出 `pendingQuestion` 状态（从 ref 改为可供消费的状态） |
| `frontend/features/chat/hooks/useMessageSender.ts` | 无需修改（现有 `consumePendingQuestion` 逻辑不变） |

### 5.2 后端

| 文件 | 修改内容 |
|------|---------|
| `backend/websocket/handlers/chat.js` | `COMMAND_HANDLERS` 新增 `deny-question` 处理器 |
| `backend/services/container/claude/templates/canUseToolTemplate.js` | stdin 监听新增 `deny-answer` 类型，resolve 为 `{behavior: 'deny'}` |

### 5.3 类型定义

| 文件 | 修改内容 |
|------|---------|
| `frontend/features/chat/types/chat.types.ts` | 无需修改（`interactiveQuestion` 已定义） |

---

## 6. 详细实现规格

### 6.1 InteractiveQuestion 组件

```tsx
// InteractiveQuestion.tsx

interface InteractiveQuestionProps {
  /** 结构化提问数据 */
  question: {
    toolUseID: string;
    questions: Array<{
      question: string;
      options?: Array<{ label: string; description?: string }>;
    }>;
    prompt?: string;
  };
  /** 是否已回答 */
  isAnswered?: boolean;
  /** 用户选择的答案（已回答时高亮） */
  selectedAnswer?: string;
  /** 点击选项回调 */
  onOptionClick?: (label: string) => void;
}
```

**渲染规则**：

1. 遍历 `questions` 数组，每个 question 渲染一个选项组
2. 每个 option 渲染为可点击按钮：`label` 为主文字，`description` 为副文字
3. 按钮样式：浅色背景 + 左侧圆角边框，hover 时高亮
4. 点击后调用 `onOptionClick(label)`，label 作为 answer 发送
5. `isAnswered = true` 时所有按钮 disabled，选中项高亮

### 6.2 deny-question 处理器（后端）

```javascript
// chat.js - COMMAND_HANDLERS 新增
'deny-question': async (data, ws, writer) => {
  const { sessionId, toolUseID } = data;
  const stdinWriter = getSessionStdin(sessionId, ws.user?.userId);
  if (!stdinWriter) {
    writer.send({ type: 'error', error: 'Session not found', sessionId });
    return;
  }
  const denyMessage = JSON.stringify({
    type: 'deny-answer',
    toolUseID,
  }) + '\n';
  stdinWriter(denyMessage);
}
```

### 6.3 canUseTool stdin 扩展

```javascript
// canUseToolTemplate.js - rl.on('line') 扩展
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (msg.type === 'user-answer' && msg.toolUseID) {
      const resolve = pendingAnswers.get(msg.toolUseID);
      if (resolve) {
        resolve(msg.answer || '');
        pendingAnswers.delete(msg.toolUseID);
      }
    }
    // 新增：deny-answer 处理
    if (msg.type === 'deny-answer' && msg.toolUseID) {
      const resolve = pendingAnswers.get(msg.toolUseID);
      if (resolve) {
        resolve(undefined, true);  // 第二个参数 true 表示 denied
        pendingAnswers.delete(msg.toolUseID);
      }
    }
  } catch (e) {
    console.error("[SDK] Skipping non-JSON stdin line:", trimmed.substring(0, 80));
  }
});
```

### 6.4 pendingQuestion 状态导出

当前 `pendingQuestionRef` 是 `useRef`，组件外部无法感知其值。需要同步一个 state 供 UI 消费：

```typescript
// useChatInterface.ts
const pendingQuestionRef = useRef<...>(null);
const [hasPendingQuestion, setHasPendingQuestion] = useState(false);

const setPendingQuestion = useCallback((toolUseID: string, sessionId: string) => {
  pendingQuestionRef.current = { toolUseID, sessionId };
  setHasPendingQuestion(true);
}, []);

const consumePendingQuestion = useCallback((answer: string): boolean => {
  const pending = pendingQuestionRef.current;
  if (pending && answer.trim()) {
    sendUserAnswer(pending.toolUseID, pending.sessionId, answer.trim());
    pendingQuestionRef.current = null;
    setHasPendingQuestion(false);
    return true;
  }
  return false;
}, [sendUserAnswer]);

// 新增：deny 当前提问
const denyPendingQuestion = useCallback(() => {
  const pending = pendingQuestionRef.current;
  if (pending) {
    sendMessage?.({
      type: 'deny-question',
      sessionId: pending.sessionId,
      toolUseID: pending.toolUseID,
    });
    pendingQuestionRef.current = null;
    setHasPendingQuestion(false);
  }
}, [sendMessage]);
```

### 6.5 ChatToolbar 取消按钮

```tsx
// ChatToolbar.tsx - 新增 props
interface ChatToolbarProps {
  // ... 现有 props
  /** Whether there is a pending question from agent */
  hasPendingQuestion?: boolean;
  /** Deny pending question callback */
  onDenyQuestion?: () => void;
}

// 渲染逻辑
{(isLoading || hasPendingQuestion) && ws && (
  <button
    type="button"
    onClick={hasPendingQuestion ? onDenyQuestion : handleAbort}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ${
      hasPendingQuestion
        ? 'bg-amber-600 hover:bg-amber-700'  // 橙色 = 取消提问
        : 'bg-red-600 hover:bg-red-700'       // 红色 = 停止会话
    }`}
  >
    {hasPendingQuestion ? t('chat.cancelQuestion') : t('chat.stop')}
  </button>
)}
```

---

## 7. 国际化

需要新增的翻译 key：

| Key | 中文 | English |
|-----|------|---------|
| `chat.cancelQuestion` | 取消提问 | Cancel Question |
| `chat.inputAnswerPlaceholder` | 输入回答... | Type your answer... |
| `chat.answerHint` | 正在回答 Agent 的提问 | Answering agent's question |

---

## 8. 边界情况

| 场景 | 处理方式 |
|------|---------|
| AskUserQuestion 无 options | 不渲染按钮，仅显示文本 + 输入框自由回答 |
| 用户连续收到多个提问 | 每次提问更新 pendingQuestion（替换上一个），保证只有一个活跃提问 |
| Agent 收到 deny 后行为 | 由 Agent 自行决定：可重新提问、跳过、或继续其他操作（SDK 层面） |
| deny 后 Agent 继续执行 | 前端等待新的消息流，与正常流程一致 |
| deny 后 Agent 再次提问 | 前端再次进入 pending 状态，渲染新的提问消息 |
| 会话已被 abort 但 pending 未清除 | 前端在收到 `session-aborted` 时清除 pendingQuestion |
| 网络断开重连 | pending 状态在内存中，重连后丢失，Agent 侧会超时（24h） |

---

## 9. 实现优先级

| 优先级 | 内容 | 预计改动量 |
|--------|------|-----------|
| **P0** | Pending 状态显示"取消提问"按钮 | 小（3 个文件） |
| **P0** | 后端 deny-question 处理 + SDK stdin 扩展 | 小（2 个文件） |
| **P1** | 前端保留 interactiveQuestion 数据 + InteractiveQuestion 组件 | 中（4 个文件） |
| **P1** | 选项按钮点击发送 user-answer | 小（复用现有 consumePendingQuestion） |
| **P2** | 输入框 pending 提示 | 小（1 个文件） |

---

## 10. 不在范围内（后续迭代）

- **`/btw` 旁聊**：允许用户在 pending 状态下发送新命令，需要队列机制
- **Rewind / Checkpoint**：回退到之前的状态，需要 SDK 层面的检查点支持
- **多问题并行**：同时存在多个未回答的 AskUserQuestion
- **超时提示**：Agent 等待回答过久时的用户提示
