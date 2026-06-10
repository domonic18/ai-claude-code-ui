# Claude Code UI - 权限控制架构

> **文档版本**: 1.0
> **创建时间**: 2026-06-09
> **最后更新**: 2026-06-09
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、权限控制总览](#一权限控制总览)
- [二、权限配置体系](#二权限配置体系)
- [三、权限数据流](#三权限数据流)
- [四、核心权限解析管道](#四核心权限解析管道)
- [五、权限决策逻辑](#五权限决策逻辑)
- [六、SDK 层工具审批](#六sdk-层工具审批)
- [七、Agent 交互问答循环](#七agent-交互问答循环)
- [八、多提供商权限映射](#八多提供商权限映射)
- [九、自主执行模式](#九自主执行模式)

---

## 一、权限控制总览

权限系统分为两个独立的控制维度：

| 维度 | 作用域 | 存储位置 | 说明 |
|------|--------|---------|------|
| **持久化设置** | 用户级 | SQLite DB | allowedTools / disallowedTools / skipPermissions |
| **运行时模式** | 每次命令 | 前端 state | permissionMode: default / acceptEdits / bypassPermissions / plan |

```
┌─────────────────── UI 层 ───────────────────┐
│                                              │
│  PermissionModeSelector.tsx  ← 每次发送时选择  │
│       ↓ permissionMode                       │
│  AgentPermissions.tsx        ← 设置页持久配置  │
│       ↓ allowedTools / disallowedTools       │
└──────────────────┬───────────────────────────┘
                   │ WebSocket: claude-command
┌──────────────────▼──────── 后端 ─────────────┐
│                                              │
│  chat.js → ClaudeQuery → DockerExecutor      │
│       ↓ options (含 permissionMode)          │
│  ScriptBuilder.filterSDKOptions()            │
│       ↓ 6 步解析管道                          │
│       ↓ determinePermissionMode()  ← 关键决策 │
│       ↓                                      │
│  generateSDKScript(permissionMode, options)   │
│       ↓                                      │
└──────────────────┬───────────────────────────┘
                   │ 容器内执行
┌──────────────────▼────── SDK 执行层 ──────────┐
│                                              │
│  SDK query({ prompt, options })              │
│       ↓ options.permissionMode               │
│       ↓ options.canUseTool = canUseTool      │
│                                              │
│  bypassPermissions → 自动放行所有工具          │
│  default → AskUserQuestion 触发交互流程       │
└──────────────────────────────────────────────┘
```

---

## 二、权限配置体系

这个权限系统有两套配置，分别管不同的事：

**持久化设置（存数据库的）**：就是用户在「设置页面 → Agent 权限」里配的东西，改一次就一直生效。有三个字段：`skipPermissions`（一个开关，打开就等于"别问我了，直接干"，默认开着）、`allowedTools`（白名单，告诉 AI 能用哪些工具，默认给了 Read、Write、Edit、Bash(git log:*)、Glob、Grep 等大概二十多个）、`disallowedTools`（黑名单，明确禁止 AI 用的工具，默认为空）。这些配置通过 `permissionsService.ts` 调 REST API，存到后端 SQLite 的 `user_settings` 表里。

**运行时模式（每次发消息时选的）**：就是聊天框工具栏上那个模式切换按钮，每次发消息时的状态，存在前端 state 里，不持久化。有四种模式：`default`（蓝色，标准模式，AI 提问时弹出来让你回答）、`acceptEdits`（绿色，自动接受文件编辑）、`bypassPermissions`（橙色，完全放行，所有工具自动批准，AI 一路执行到底不问你）、`plan`（紫色，规划模式，只看不执行）。

当两个配置冲突时，优先级是：**前端当前选的模式 > 数据库里存的设置 > 系统默认值**。比如数据库里 skipPermissions=true，但这次手动选了 default 模式，那这次就用 default。

### 2.1 持久化设置（用户级，数据库存储）

**前端组件**: `frontend/features/settings/components/agent/AgentPermissions.tsx`

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `skipPermissions` | boolean | `true` | 是否跳过权限检查 |
| `allowedTools` | string[] | `DEFAULT_CLAUDE_TOOLS` | 允许的工具白名单 |
| `disallowedTools` | string[] | `[]` | 禁止的工具黑名单 |

**存储路径**: `permissionsService.ts` → REST API → `UserSettingsService.js` → SQLite `user_settings` 表

**默认允许的工具**（`backend/shared/constants/defaultTools.js` + `ScriptBuilder.js`）：

```
Bash(git log:*), Bash(git diff:*), Bash(git status:*),
Bash(cp:*), Bash(mkdir:*), Bash(pdftotext:*), Bash(pandoc:*), Bash(file:*),
Write, Read, Edit, Glob, Grep, MultiEdit,
Task, TodoWrite, TodoRead, WebFetch, WebSearch, Skill, AskUserQuestion
```

### 2.2 运行时模式（每次命令，前端选择）

**前端组件**: `frontend/features/chat/components/PermissionModeSelector.tsx`

| 模式 | 颜色 | 效果 |
|------|------|------|
| `default` | 蓝色 | 标准行为，AskUserQuestion 触发交互提示 |
| `acceptEdits` | 绿色 | 自动接受文件编辑 |
| `bypassPermissions` | 橙色 | 绕过所有权限检查，自动回答所有提问 |
| `plan` | 紫色 | 规划模式，不执行 |

### 2.3 设置优先级

```
     ┌────────────────────────┐
     │  前端 per-command 设置  │  ← 最高优先级
     │  (permissionMode)      │
     ├────────────────────────┤
     │  数据库用户设置         │
     │  (allowedTools 等)     │
     ├────────────────────────┤
     │  系统默认值             │  ← 最低优先级
     │  (DEFAULT_ALLOWED_...) │
     └────────────────────────┘
```

---

## 三、权限数据流

权限配置从"用户点了一下"到"AI 真正执行时被约束"的完整传递过程：

**起点 — 两条配置路径**：用户有两种方式影响权限。路径 A 是运行时模式——用户在聊天工具栏选了个模式（比如 bypassPermissions），每次点发送时 `useMessageSender` 会把这个 permissionMode 塞到 WebSocket 消息的 options 里跟着问题一起发给后端。路径 B 是持久化设置——用户在设置页配的 allowedTools、disallowedTools 早已通过 REST API 存到了 SQLite 里，发送消息时不会带这些值，而是后端在需要时自己去数据库读。

**中间 — 后端拼接**：后端收到消息后经过 chat.js → ClaudeQuery → DockerExecutor 一路传递，不改变权限字段。真正干活的是 `ScriptBuilder.filterSDKOptions()` 这个函数：先去数据库把用户的持久化设置读出来补上缺失字段，再看前端有没有带 toolsSettings 过来覆盖数据库值，如果 allowedTools 还是空的就灌入系统默认列表，加载扩展，然后做关键决策（determinePermissionMode）综合判断这次到底用什么权限模式，最后清理内部字段、合并禁止工具列表。如果最终判定是 bypassPermissions，还会往 systemPrompt 里注入 11 条自主执行规则告诉 AI"别问问题，直接干"。

**终点 — SDK 执行**：解析完的权限配置被打包成 options 对象，通过 `generateSDKScript()` 生成 Node.js 脚本写入容器 /tmp/ 目录，然后 `node sdk_exec_xxx.mjs` 在容器里跑起来。SDK 拿到 options 后就知道该怎么做了——bypassPermissions 就自动放行所有工具，default 就在遇到 AskUserQuestion 时通过 stdin/stdout 和用户交互。

一句话总结：**前端选的模式跟着消息走 → 后端从数据库补全配置 → ScriptBuilder 综合决策 → 打包传进容器 → SDK 按规则执行。**

```
[PermissionModeSelector]         [AgentPermissions]
  per-command 模式                  DB 持久化设置
        │                               │
        ▼                               ▼
  useMessageSender              permissionsService.ts
        │                               │
        │                    PUT /api/users/settings/claude
        │                               │
        │                     UserSettingsService.js
        │                               │
        │                          SQLite DB
        │                               │
        ▼                               │
  WebSocket: { type: "claude-command",   │
    options: { permissionMode, ... } }   │
        │                               │
        ▼                               ▼
  chat.js → handleClaudeCommand()    mergeUserSettings()
        │                               │
        ▼                               │
  DockerExecutor ────────────→ ScriptBuilder.filterSDKOptions()
                                    │
                                    ▼
                              6 步解析管道（见下节）
```

---

## 四、核心权限解析管道

**文件**: `backend/services/container/claude/ScriptBuilder.js` → `filterSDKOptions()`

```
输入: options (含 permissionMode, toolsSettings, userId)
  │
  ▼
[1] mergeUserSettings(sdkOptions, settings, userId)
    │  → UserSettingsService.getSettings(userId, "claude")
    │  → applySettingIfMissing: DB allowedTools/disallowedTools 填充缺失字段
    │
    ▼
[2] applyFrontendOverrides(sdkOptions, settings)
    │  → 前端 toolsSettings 覆盖 DB 值
    │
    ▼
[3] setDefaultTools(sdkOptions)
    │  → 无 allowedTools 时注入 DEFAULT_ALLOWED_TOOLS
    │
    ▼
[4] configureExtensions(sdkOptions, options)
    │  → 加载 agents 和 plugins
    │
    ▼
[5] determinePermissionMode(sdkOptions, settings)  ← 关键决策
    │  → 确定 permissionMode（见第五节决策树）
    │  → 返回 userDisallowedTools 列表
    │
    ▼
[6] cleanupSdkOptions(sdkOptions, options, userDisallowedTools)
    │  → 移除内部字段 (userId, images 等)
    │  → 合并禁止工具: userDisallowedTools + [EnterPlanMode, ExitPlanMode]
    │
    ▼
[7] bypassPermissions? → injectAutonomousSystemPrompt(sdkOptions)
    │  → 注入 11 条自主执行规则到 systemPrompt.append
    │
    ▼
输出: sdkOptions (→ generateSDKScript → 容器执行)
```

---

## 五、权限决策逻辑

**文件**: `backend/services/container/claude/helpers/permissionModeHelper.js`

```
              开始
                │
                ▼
     前端传入了 permissionMode?
        │                │
       是                否
        │                │
        ▼                ▼
  使用前端指定的模式    skipPermissions=true
        │              且无用户禁止工具?
        │              │           │
        │             是           否
        │              │           │
        │              ▼           ▼
        │         bypass      使用默认工具列表
        │         Permissions  且无用户禁止工具?
        │              │     │           │
        │              │    是           否
        │              │     │           │
        │              │     ▼           ▼
        │              │  bypass      default
        │              │  Permissions
        │              │
        ▼              ▼
  使用前端指定的模式? ──── 是 → allowDangerouslySkipPermissions = true
        │
        否
        │
        ▼
  正常执行 (无需额外标志)
```

**关键规则**：
- `bypassPermissions` 时必须设置 `allowDangerouslySkipPermissions = true`（SDK 要求）
- 系统级始终禁用：`EnterPlanMode`, `ExitPlanMode`
- `AskUserQuestion` 始终允许（支持 Agent 向用户提问）

---

## 六、SDK 层工具审批

**文件**: `backend/services/container/claude/templates/canUseToolTemplate.js`

### bypassPermissions 模式（自动回答）

```
SDK 调用 canUseTool("AskUserQuestion", ...)
  │
  ▼
自动回复 "继续"
  │  → stdout: { type: "agent-question-auto-answered" } （仅审计日志）
  │
  ▼
return { behavior: "allow", updatedInput: { ...input, answer: "继续" } }

其他工具 → return { behavior: "allow", updatedInput: input }
```

### default / acceptEdits 模式（交互式）

```
SDK 调用 canUseTool("AskUserQuestion", ...)
  │
  ▼
stdout: { type: "agent-question", toolUseID, questions, prompt }
  │
  ▼
return new Promise(...)  ← 阻塞等待 stdin
  │
  │  ... 用户回答通过 stdin 传入 ...
  │
  ▼
stdin 收到: { type: "user-answer", toolUseID, answer }
  │
  ▼
resolve({ behavior: "allow", updatedInput: { ...input, answer } })

其他工具 → return { behavior: "allow", updatedInput: input }  （自动放行）
```

---

## 七、Agent 交互问答循环

当 permissionMode 非 bypass 时，AskUserQuestion 的完整交互流程：

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│ 前端 UI  │     │ 后端 WS  │     │ 容器     │     │ SDK     │
└────┬────┘     └────┬─────┘     └────┬─────┘     └────┬────┘
     │               │                │                │
     │               │                │  canUseTool    │
     │               │                │◄───────────────┤
     │               │                │                │
     │               │                │ stdout:         │
     │               │                │ agent-question  │
     │               │◄───────────────┤                │
     │               │                │                │
     │  WS: agent-   │                │                │
     │  question     │                │                │
     │◄──────────────┤                │                │
     │               │                │                │
     │ setPending    │                │                │
     │ Question()    │                │                │
     │               │                │                │
     │ 渲染问题文本    │                │                │
     │               │                │                │
     │ 用户输入回答    │                │                │
     │               │                │                │
     │ WS: user-     │                │                │
     │ answer        │                │                │
     ├──────────────►│                │                │
     │               │                │                │
     │               │ stdin:         │                │
     │               │ user-answer    │                │
     │               ├───────────────►│                │
     │               │                │                │
     │               │                │ Promise resolve│
     │               │                ├───────────────►│
     │               │                │                │
     │               │                │   Agent 继续   │
     │               │                │                │
```

**关键文件**：
- 前端拦截回答：`useMessageSender.ts` → `consumePendingQuestion()`
- 后端转发：`chat.js` → `COMMAND_HANDLERS["user-answer"]` → `getSessionStdin()` → 容器 stdin

---

## 八、多提供商权限映射

| 提供商 | 权限参数 | bypass 机制 | 工具过滤 | 交互问答 |
|--------|---------|------------|---------|---------|
| **Claude** | `permissionMode` + `allowedTools` + `disallowedTools` | `allowDangerouslySkipPermissions=true` | ✅ 白名单/黑名单 | ✅ stdin/stdout |
| **Codex** | `sandboxMode` + `approvalPolicy` | `sandboxMode: "danger-full-access"` | ✅ sandbox 级别 | ❌ |
| **Cursor** | CLI `-f` flag | `-f` (force) 参数 | ❌ | ❌ |

**Codex 模式映射**（`codexPermissionMapper.js`）：

| Claude 模式 | Codex 映射 |
|------------|-----------|
| `default` | `{ sandboxMode: "workspace-write", approvalPolicy: "untrusted" }` |
| `acceptEdits` | `{ sandboxMode: "workspace-write", approvalPolicy: "never" }` |
| `bypassPermissions` | `{ sandboxMode: "danger-full-access", approvalPolicy: "never" }` |

---

## 九、自主执行模式

当 `permissionMode === "bypassPermissions"` 时，系统执行两项额外操作：

### 9.1 自主系统提示词注入

**文件**: `ScriptBuilder.js` → `injectAutonomousSystemPrompt()`

通过 SDK 的 `systemPrompt.append` 机制追加 11 条规则，核心约束：

1. **禁止提问**：不输出任何需要用户回复的问题
2. **禁止等待确认**：不暂停等待用户确认
3. **完整执行**：自动完成所有步骤，不在中间中断
4. **禁止 AskUserQuestion**：不调用该工具
5. **自行决策**：遇到歧义自行判断
6. **持续执行**：只有全部完成才输出结果
7. **禁止退化循环**：检测到重复输出时立即停止

### 9.2 canUseTool 自动回答

`canUseTool` 回调自动将所有工具调用放行，AskUserQuestion 自动回复"继续"。

### 9.3 双重保障

- **系统提示词** → 告诉 AI 不要提问（预防层）
- **canUseTool 回调** → 即使 AI 违反规则提问也自动回答（兜底层）

---

## 相关文档

- [架构概述](./architecture-overview.md)
- [流式输出架构](./streaming-output-architecture.md)
- [核心模块设计](./core-modules-design.md)
- [安全部署配置](./security-deployment-config.md)
- [Agent 交互提问设计](../design/agent-interactive-question-design.md)

---

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|---------|
| 1.0 | 2026-06-09 | Claude | 初版：权限控制完整架构 |
