# GPT 模型接入验证记录

> **文档版本**：v1.7
> **创建日期**：2026-05-19
> **最后更新**：2026-05-26
> **验证状态**：完成
> **关联文档**：[GPT模型接入方案对比报告](./GPT模型接入方案对比报告.md)

---

## 一、验证概述

### 目标

在**不修改 Claude Agent SDK 调用代码**的前提下，让 Claude Code UI 支持 GPT 模型。

### 核心架构

```
Claude Agent SDK (Anthropic 格式)
  → 协议翻译层 (Anthropic ↔ OpenAI)
  → 目标模型 API (GPT 等)
```

### 验证环境

| 项目 | 详情 |
|------|------|
| **宿主机** | macOS, Docker Desktop |
| **VPN** | Clash Verge (端口 7897, Allow LAN 已开启) |
| **测试脚本** | `scripts/test-openrouter-gpt.mjs` |
| **SDK 版本** | `@anthropic-ai/claude-agent-sdk@0.2.59` |

### 测试矩阵（5 项）

| # | 测试项 | 验证目标 |
|---|--------|---------|
| 1 | 基本对话 | Anthropic Messages API 格式请求能否正常响应 |
| 2 | 流式对话 | SSE 流式分块是否正确 |
| 3 | 工具调用（非流式） | 模型能否理解和返回 `tool_use` |
| 4 | 工具结果回传 | 多轮 `tool_use → tool_result` 循环是否完整 |
| 5 | 流式工具调用 | 流式 SSE 中 `tool_use` 块是否完整（**核心风险项**） |

---

## 二、方案 A：OpenRouter（已验证通过 ✅）

### 验证时间

2026-05-19

### 架构

```
SDK (容器内) → 宿主机 Clash VPN → OpenRouter 翻译层 → GPT API
```

### 前提条件

1. 宿主机安装 Clash Verge（或其他 VPN 客户端）
2. Clash Verge 开启 **「允许局域网连接」(Allow LAN)**
3. 项目代码中 `DockerExecutor.js` 注入代理环境变量：

```javascript
env: {
  // ... 原有配置
  HTTP_PROXY: 'http://host.docker.internal:7897',
  HTTPS_PROXY: 'http://host.docker.internal:7897',
  NO_PROXY: 'localhost,127.0.0.1,.local'
}
```

### 验证步骤

```bash
# 步骤 1：直接测试 OpenRouter（带 VPN 代理）
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
OPENROUTER_API_KEY=sk-or-v1-xxxxx \
node scripts/test-openrouter-gpt.mjs
```

### 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | GPT-4o/Mistral 等模型正常响应 |
| 流式对话 | ✅ 通过 | SSE 分块正确 |
| 工具调用（非流式） | ✅ 通过 | tool_use 参数完整 |
| 工具结果回传 | ✅ 通过 | 多轮循环正常 |
| 流式工具调用 | ✅ 通过 | 流式中 tool_use 块完整，无数据丢失 |

### 环境配置

```bash
# .env.deploy 配置
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api
PROVIDER_OPENROUTER_API_KEY=sk-or-v1-xxxxx
AVAILABLE_MODELS=...|openai/gpt-4.1:OpenRouter|openai/gpt-4o:OpenRouter|openai/gpt-5.5:OpenRouter
```

### 验证结论

| 维度 | 结论 |
|------|------|
| **协议翻译** | ✅ 5 项全过，Anthropic↔OpenAI 格式翻译可靠 |
| **流式工具调用** | ✅ 无数据丢失（社区报告的风险未复现） |
| **区域限制** | ⚠️ 依赖宿主机 VPN，VPN 中断则 GPT 不可用 |
| **代码改动** | 极小（DockerExecutor.js 加 3 行 env） |

### ⚠️ 补充发现：GPT 工具使用质量低于 Claude

2026-05-19 在生产任务（生成专利文件）中发现问题：

```
Read 工具报错: Invalid pages parameter: ""
```

GPT 调用 `Read` 工具时传了空字符串 `pages=""`，而 Claude 原生使用时不会出现此问题。

**这说明协议翻译层没有问题，但 GPT 模型自身对复杂工具的理解和使用质量不如 Claude**，具体表现：

| 对比项 | Claude 原生 | GPT (通过 OpenRouter) |
|--------|-----------|----------------------|
| **协议格式** | ✅ 原生无误 | ✅ 翻译正确 |
| **工具参数准确性** | ✅ 准确 | ⚠️ 偶发参数缺失/错误 |
| **复杂多工具场景** | ✅ 稳定 | ⚠️ 可能随机出错 |

这是 **模型能力的固有差异**，不是翻译层可以解决的。GPT 在简单工具调用场景（如 get_weather）表现良好，但在复杂项目工具链（Read/Write/Edit/Bash 等 18+ 工具）中参数准确性不如 Claude。
---

## 三、方案 B：Claude Bridge / CLASP + 老张 API（部分通过 ⚠️）

### 验证时间

2026-05-19

### 架构

```
SDK (本机) → Claude Bridge (localhost:8080, 协议翻译) → 老张 API (国内直连) → GPT-4o
```

### 前提条件

无 VPN 需求，老张 API 国内直连。

### 验证步骤

```bash
# 步骤 1：启动 Claude Bridge 翻译代理
npx claude-bridge \
  -u https://api.laozhang.ai/v1 \
  -k sk-老张API密钥 \
  -m gpt-4o \
  -p 8080

# 步骤 2：新开终端，运行测试（使用专用本地代理测试脚本）
ADAPTER_BASE_URL=http://localhost:8080/v1 \
  ADAPTER_API_KEY=sk-any \
  TEST_MODEL=gpt-4o \
  node scripts/test-claude-bridge.mjs
```

### 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | 老张 API 直连 GPT-4o 正常 |
| 流式对话 | ❌ 失败 | Claude Bridge 流式翻译有问题，未收到有效 chunk |
| 工具调用（非流式） | ✅ 通过 | `get_weather` 工具调用正确，参数完整 |
| 工具结果回传 | ❌ 失败 | `tool_use` ID 格式不匹配（Anthropic `toolu_*` vs OpenAI `call_*`） |
| 流式工具调用 | ❌ 失败 | 流式 SSE 中未解析到 tool_use 块 |

### 错误分析

**工具结果回传 400 错误**：
```
An assistant message with 'tool_calls' must be followed by tool messages
responding to each 'tool_call_id'. The following tool_call_ids did not have
response messages: call_2Jz3bu3mPMsO7wbZV9YGF27m
```

根本原因：Claude Bridge 在翻译多轮消息时，Anthropic 的 `tool_use.id`（格式 `toolu_*`）和 OpenAI 的 `tool_call_id`（格式 `call_*`）之间的 ID 映射断裂。第一轮返回的 `tool_call_id` 在第二轮消息中没有被正确回传。

### 验证结论

| 维度 | 结论 |
|------|------|
| **老张 API 本身** | ✅ GPT 模型可正常调用，国内直连无问题 |
| **Claude Bridge 翻译** | ⚠️ 基本对话和单轮工具调用可用，流式和多轮工具调用有 Bug |
| **区域限制** | ✅ 不需要 VPN |
| **可用性** | ❌ 当前不可用于生产（流式 + 多轮工具调用是 Claude Code 核心场景） |

---

## 四、方案 C：Claude Adapter（已验证通过 ✅）

### 验证时间

2026-05-19 12:21 UTC+8

### 项目信息

| 项目 | 详情 |
|------|------|
| **仓库** | https://github.com/shantoislamdev/claude-adapter |
| **npm** | https://www.npmjs.com/package/claude-adapter |
| **安装** | `npm install -g claude-adapter` |
| **启动** | `claude-adapter`（交互式配置） |
| **默认端口** | 3080 |
| **运行时** | Node.js 本地 HTTP 代理（非 Cloudflare Worker） |
| **翻译方向** | 双向翻译（Anthropic ↔ OpenAI） |

### 与 Claude Bridge 的区别

| 对比项 | Claude Adapter | Claude Bridge |
|--------|:--------------:|:-------------:|
| 安装方式 | `npm install -g claude-adapter` | `npx claude-bridge` |
| 默认端口 | 3080 | 8000 / 8080 |
| 配置方式 | 交互式向导 / 程序化 API | 命令行参数 |
| 自动重配 | 自动修改 `~/.claude/settings.json` | 需手动设置环境变量 |

### 架构

```
SDK (本机) → Claude Adapter (localhost:3080, 协议翻译) → 目标 API (OpenAI/老张 API 等)
```

### 验证步骤

```bash
# 步骤 1：安装 Claude Adapter（如已安装则跳过）
npm install -g claude-adapter

# 步骤 2：启动 Claude Adapter（按提示配置目标 API 和模型映射）
claude-adapter

# 步骤 3：新开终端，运行专有测试脚本
ADAPTER_BASE_URL=http://localhost:3080 \
  ADAPTER_API_KEY=default-key \
  TEST_MODEL=gpt-4o \
  node scripts/test-claude-adapter.mjs
```

### 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | `gpt-4o` 通过老张 API 直连，响应正常 |
| 流式对话 | ✅ 通过 | SSE 分块正确，`message_start`/`message_stop` 事件完整 |
| 工具调用（非流式） | ✅ 通过 | `get_weather` 工具调用正确，参数完整 |
| 工具结果回传 | ✅ 通过 | 多轮对话正常，ID 映射翻译正确 |
| 流式工具调用 | ✅ 通过 | `input_json_delta` 翻译正确，无数据丢失 |

### 与旧版测试脚本的差异

新脚本 `scripts/test-claude-adapter.mjs` 相比旧的 `test-claude-bridge.mjs`（测试 Claude Bridge 用）做了以下改进：

| 改进项 | 旧脚本 | 新脚本 |
|--------|--------|--------|
| 默认端口 | 8080（Claude Bridge 的端口） | **3080**（Claude Adapter 的端口） |
| 工具结果构造 | 保留了 text block 在 tool_result 中 | **只包含 tool_result block** |
| SSE 解析 | 只解析 `data:` 行，忽略 `event:` 行 | **解析 event 类型**，更准确识别 chunk |
| 调试支持 | 无 | **TEST_DEBUG** 环境变量打印原始 SSE |
| 错误分析 | 通用错误消息 | **详细的错误分析**（如 ID 映射断裂提示） |
| 参数验证 | 只检查工具调用存在 | **完整解析 input_json_delta**，验证 JSON 完整性 |

---

### 方案 C 补充验证：完整 Docker 集成（已验证通过 ✅）

#### 验证时间

2026-05-20 08:16 UTC+8

#### 架构

```
前端 (浏览器) → WebSocket → 后端 (Express) → Docker 沙箱 → SDK → Claude Adapter (宿主机:3080) → 老张 API → GPT-5.5
```

#### 验证内容

| # | 测试项 | 验证目标 |
|---|--------|---------|
| 1 | 前端→后端→Docker 完整链路 | 从浏览器选择 gpt-5.5 发送消息，经完整链路到达 Claude Adapter |
| 2 | SDK 内部模型传递 | `options.model = gpt-5.5` 正确传递，SDK 不依赖 `ANTHROPIC_MODEL` 环境变量 |
| 3 | 容器内代理配置 | `NO_PROXY` 包含 `host.docker.internal`，SDK 流量不走 Clash 代理 |
| 4 | GPT 工具调用 | 复杂多工具场景（专利交底书撰写）正常完成 |
| 5 | 流式响应 | 47 个 chunk（含多轮 tool_use/tool_result）完整传输，无错误 |

#### 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | "你好吗" → GPT 回复"我很好，谢谢！" |
| 交底书生成 | ✅ 通过 | 完整生成技术交底书，47 chunks，17,265 tokens |
| 容器内网络 | ✅ 通过 | `host.docker.internal:3080` 可直达 Claude Adapter |
| 代理隔离 | ✅ 通过 | `host.docker.internal` 已加入 `NO_PROXY`，不走 Clash 代理 |
| 多轮对话 | ✅ 通过 | 含工具调用的复杂场景运行正常 |

#### Docker 日志摘要

```
08:16:02  [ClaudeQuery] modelName: "gpt-5.5", providerBaseURL: "http://host.docker.internal:3080"
08:16:03  [SDK] - ANTHROPIC_BASE_URL: http://host.docker.internal:3080
08:16:03  [SDK] Options model: gpt-5.5
08:16:04  [SDK] First token received (TTFT: 1970ms)
08:16:05  [SDK] Received chunk #2 type=system
08:16:25  [SDK] Received chunk #4 type=assistant → "我很好，谢谢！"
08:16:55  [Chat] 用户请求：帮我生成交底书吧
08:16:55  [ClaudeQuery] model: gpt-5.5 (第二轮)
08:17:12~08:26:39  [SDK] 多轮 tool_use/tool_result 交互，共 47 chunks
08:27:40  [SDK] Query complete, total chunks: 47
08:27:40  [MessageTransformer] (17,265 tokens) → "已完成技术交底书生成"
```

**全程无 ERROR 日志，无 ECONNREFUSED，无 process exit code 1。**

#### 已知缺点

| # | 缺点 | 说明 |
|---|------|------|
| 1 | **模型映射不可控** | SDK 内部将模型名映射到 opus/sonnet/haiku 三个 tier，虽然后续 Claude Adapter 透传原始模型名，但 SDK 的映射逻辑不透明，版本升级后可能行为变化 |
| 2 | **单点故障** | Claude Adapter 是宿主机独立进程，进程挂了则所有 GPT 模型不可用；宿主机重启后需手动重启，建议配置 launchd 开机自启 |
| 3 | **无监控与日志持久化** | Claude Adapter 日志仅输出到终端，无请求/错误/性能数据的持久化记录，问题排查不便 |
| 4 | **协议翻译延迟开销** | 每次请求多一层 HTTP 转发 + JSON 格式转换，增加翻译开销（实测 TTFT ~2s，与直接调用相当，但额外开销存在） |
| 5 | **仅适合单机部署** | 多台宿主机场景需要每台独立安装和维护 |

> 对 Mac mini 单机场景而言，以上缺点均可接受。主要关注点：**进程挂了无人知晓**，建议配置守护进程或开机自启。

### 验证结论

| 维度 | 结论 |
|------|------|
| **协议翻译** | ✅ Docker → SDK → Claude Adapter → 老张 API 完整链路正常 |
| **代理配置** | ✅ `NO_PROXY` 包含 `host.docker.internal`，Claude Adapter 流量直连 |
| **流式工具调用** | ✅ 47 chunks 含多轮工具调用，完整无错误 |
| **SDK 兼容性** | ✅ 不依赖 `ANTHROPIC_MODEL` 环境变量，通过 `options.model` 传递模型名 |
| **生产可用性** | ✅ 可投入生产使用，但建议配置守护进程防止单点故障 |
| **模型扩展** | ✅ 新增任意模型仅需在 `.env.deploy` 中添加条目，无需改代码 |

---

## 五、方案 D：Claude Adapter + One-API 新加坡节点（已验证通过 ✅）

### 验证时间

2026-05-26

### 背景

方案 C（Claude Adapter + 老张 API）在实际使用中存在以下问题：
1. 老张 API 为个人维护的 API 代理服务，稳定性和 SLA 无法保障
2. 部分模型（如 gpt-5.5）在老张 API 上不可用
3. Docker 容器内调用时出现 `max_output_tokens: 0` 错误（Claude-Adapter bug）

经调研发现公司有新加坡节点的 One-API 服务（`api.hk33smarter.com`），可提供 228 个模型（含 69 个 GPT/OpenAI 系列），且**国内直连无需 VPN**。

### 架构

```
Docker 容器 (Claude Agent SDK)
  ↓ ANTHROPIC_BASE_URL=http://host.docker.internal:3080
Claude-Adapter (宿主机 :3080, 协议翻译 Anthropic → OpenAI)
  ↓ https://api.hk33smarter.com/v1/chat/completions
One-API 新加坡节点 (腾讯云)
  ↓ 内部路由
OpenAI GPT-5.2 / GPT-5.4
```

### 前提条件

1. Claude-Adapter 已安装并启动（默认端口 3080）
2. Claude-Adapter 上游配置为 One-API 新加坡节点：
   ```json
   // ~/.claude-adapter/config.json
   {
     "baseUrl": "https://api.hk33smarter.com/v1",
     "apiKey": "sk-xxx（One-API 密钥）",
     "models": {
       "opus": "gpt-5.2",
       "sonnet": "gpt-5.2",
       "haiku": "gpt-4.1-nano"
     },
     "toolFormat": "native"
   }
   ```
3. **无需 VPN**：One-API 部署在腾讯云香港/新加坡，国内直连

### 验证工具

| 项目 | 详情 |
|------|------|
| **直连测试脚本** | `接入openai类模型测试/测试脚本/test-one-api-direct.mjs` |
| **端到端测试脚本** | `接入openai类模型测试/测试脚本/test-one-api-e2e.mjs` |
| **共享测试套件** | `接入openai类模型测试/测试脚本/test-translation-suite.mjs` |

### 测试一：One-API 直连测试（OpenAI 协议，7 项）

> 验证 One-API 端点本身的连通性和功能完整性

```bash
ONE_API_BASE_URL=https://api.hk33smarter.com/v1 \
ONE_API_KEY=sk-xxx \
TEST_MODEL=gpt-5.2 \
node 接入openai类模型测试/测试脚本/test-one-api-direct.mjs
```

| # | 测试项 | 结果 | 备注 |
|---|--------|------|------|
| 0 | 网络连通性 | ✅ 通过 | DNS 解析 `43.153.222.253`，TCP 561ms |
| 1 | 模型列表 | ✅ 通过 | 228 个模型，69 个 GPT 系列，含 gpt-5.2/gpt-5.4 |
| 2 | 基本对话（非流式） | ✅ 通过 | 响应 2.9s，`max_tokens` 参数正常 |
| 3 | 流式对话 | ✅ 通过 | 12 chunks，2.7s，需用 `max_completion_tokens`（非 `max_tokens`） |
| 4 | Tool Calling（非流式） | ✅ 通过 | `get_weather` 函数调用正确，参数完整 |
| 5 | Tool Calling 多轮 | ✅ 通过 | 工具结果回传正常，模型基于结果生成回复 |
| 6 | 流式 Tool Calling | ✅ 通过 | `tool_calls[0].function.arguments` delta 完整解析 |

**结论：7/7 全部通过。One-API 新加坡节点功能完整，可作为 Claude-Adapter 上游。**

**关键发现：GPT-5.x 流式请求必须使用 `max_completion_tokens` 而非 `max_tokens`**，否则返回 400 错误 `integer below minimum value. Expected >= 16, but got 0`。

### 测试二：端到端测试（Anthropic 协议 → Claude-Adapter → One-API，5 项）

> 验证完整链路的协议翻译和工具调用

```bash
ADAPTER_BASE_URL=http://localhost:3080/v1 \
ADAPTER_API_KEY=default-key \
TEST_MODEL=gpt-5.2 \
node 接入openai类模型测试/测试脚本/test-one-api-e2e.mjs
```

| # | 测试项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 基本对话（非流式） | ✅ 通过 | Anthropic 格式 → OpenAI 格式翻译正确 |
| 2 | 流式对话 | ✅ 通过 | SSE `message_start`/`message_stop` 事件完整 |
| 3 | 工具调用（非流式） | ✅ 通过 | `tool_use` 块翻译正确，ID 格式 `call_*`（非 `toolu_*`） |
| 4 | 工具结果回传（多轮） | ✅ 通过 | ID 映射正确，多轮 `tool_use → tool_result` 循环完整 |
| 5 | 流式工具调用 | ✅ 通过 | `input_json_delta` 翻译完整，JSON 解析无数据丢失 |

**结论：5/5 全部通过。Claude-Adapter + One-API 完整链路可用于生产环境。**

### 已知问题：Claude-Adapter `max_tokens=0` Bug

**现象**：Docker 容器内通过 Claude Agent SDK 调用时，报错：

```
Error: API Error: 400 {"error":{"type":"invalid_request_error",
"message":"Invalid 'max_output_tokens': integer below minimum value.
Expected a value >= 16, but got 0 instead."}}
```

**根因**：Claude Agent SDK 在某些场景（如 prompt caching 预热请求、会话初始化）会发送 `max_tokens: 0`。Claude-Adapter 只对 `max_tokens === 1` 做了兜底（改成 32），没有覆盖 `max_tokens === 0` 的情况，直接透传给了上游。

**问题代码位置**：`/opt/homebrew/lib/node_modules/claude-adapter/dist/converters/request.js:73`

```javascript
// 当前代码（只处理 max_tokens === 1）
const maxTokens = anthropicRequest.max_tokens === 1 ? 32 : anthropicRequest.max_tokens;

// 应改为（兜底所有小于 16 的值）
const maxTokens = (anthropicRequest.max_tokens < 16) ? 16384 : anthropicRequest.max_tokens;
```

**状态**：待修复。修复后需重启 Claude-Adapter 并重新部署。

### 可用模型（One-API 新加坡节点，重点列表）

| 类别 | 模型 |
|------|------|
| **GPT-5.x 系列** | `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro`, `gpt-5.1`, `gpt-5.2`, `gpt-5.2-high`, `gpt-5.2-low`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| **OpenAI 命名空间** | `openai/gpt-5.2`, `openai/gpt-5.2-pro`, `openai/gpt-5.3-chat`, `openai/gpt-5.4`, `openai/gpt-5.4-pro` |
| **Codex 系列** | `openai/gpt-5-codex`, `openai/gpt-5.1-codex-max` |
| **推理系列** | `o3`, `o3-pro`, `o4-mini`, `o3-deep-research`, `o4-mini-deep-research` |
| **经典模型** | `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano` |

> **注意**：没有 `gpt-5.5`，最高到 `gpt-5.4` 系列。

### 环境配置

```bash
# .env.deploy 配置
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-5.2:Claude Adapter|gpt-5.4:Claude Adapter

# .env 本地开发
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-5.2:Claude Adapter|gpt-5.4:Claude Adapter
```

### 网络特性

| 指标 | 值 |
|------|-----|
| **DNS 解析** | `43.153.222.253`（腾讯云） |
| **TCP 连接延迟** | 241ms（国内直连） |
| **TTFT（首 token）** | ~610ms |
| **需要 VPN** | **否** |
| **One-API 节点** | 新加坡（公司统一运维） |

### 验证结论

| 维度 | 结论 |
|------|------|
| **协议翻译** | ✅ Claude-Adapter + One-API 完整链路，5/5 全过 |
| **网络连通** | ✅ 国内直连，无需 VPN，延迟 241ms |
| **模型可用性** | ✅ 228 个模型，含最新 gpt-5.4 系列 |
| **max_tokens bug** | ⚠️ Claude-Adapter 对 `max_tokens=0` 未做兜底，需修复后重测 Docker 集成 |
| **运维便利性** | ✅ 公司统一运维 One-API，比老张 API 更稳定可靠 |
| **生产可用性** | ⚠️ 修复 max_tokens bug 后可投入生产 |

---

## 六、方案对比总结

| 维度 | OpenRouter + VPN | Claude Bridge + 老张 API | Claude Adapter + 老张 API | Claude Adapter + One-API 新加坡 |
|------|:----------------:|:-----------------------:|:------------------------:|:----------------------------:|
| **基本对话** | ✅ | ✅ | ✅ | ✅ |
| **流式对话** | ✅ | ❌ | ✅ | ✅ |
| **工具调用（非流式）** | ✅ | ✅ | ✅ | ✅ |
| **工具结果回传** | ✅ | ❌ | ✅ | ✅ |
| **流式工具调用** | ✅ | ❌ | ✅ | ✅ |
| **需要 VPN** | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| **上游稳定性** | ⚠️ SaaS 第三方 | ⚠️ 个人维护 | ⚠️ 个人维护 | ✅ 公司运维 |
| **模型丰富度** | 中 | 低 | 低 | ✅ 高（228个） |
| **Docker 集成** | ✅ | ❌ | ✅ | ⚠️ 需修复 max_tokens bug |
| **翻译层评分** | 3.85/5 | 不可用 | 4.0/5 | **4.5/5** |

### 关键发现

1. **OpenRouter 的翻译层质量可靠**，5 项全过，但依赖宿主机 VPN
2. **Claude Adapter 翻译质量与 OpenRouter 相当**，5 项全过，且**不依赖特定 SaaS**
3. **老张 API 本身没有问题**，配合 Claude Adapter 可实现国内直连
4. **Claude Bridge 与 Claude Adapter 是不同项目**，翻译质量差异很大（Bridge 2/5 vs Adapter 5/5）
5. **流式 + 工具调用的翻译是普遍技术难点**：OpenRouter 和 Claude Adapter 做到了，Claude Bridge 和 LiteLLM 做不到
6. **One-API 新加坡节点是最佳上游选择**：公司运维、国内直连、无需 VPN、模型丰富（228个）、稳定性高于个人维护的老张 API

### 推荐方案排序

| 排名 | 方案 | 评分 | 适用场景 |
|------|------|------|---------|
| 1 | **Claude Adapter + One-API 新加坡** | **4.5/5** | **当前推荐**，公司运维稳定，模型丰富，无需 VPN |
| 2 | **Claude Adapter + 老张 API** | **4.0/5** | 备选方案，无需 VPN，全功能通过 |
| 3 | **OpenRouter + 宿主机 VPN** | 3.85 | 备选方案，依赖 VPN |
| 4 | **海外 VPS + Claude Adapter + OpenAI 直连** | 4.0 | 海外部署，无区域限制 |

---

## 七、跨 Provider 模型切换验证（补充）

### 验证时间

2026-05-20 17:20 UTC+8 (初始验证)
2026-05-20 18:10 UTC+8 (修正分析)

### 背景

Claude Code UI 支持在同一个会话中切换模型（`resume: true + sessionId`），用户可能在不同 provider 的模型之间切换（如 Laozhang → Claude Adapter → Moonshot AI），此时需要验证：
1. **Provider 配置切换**：`baseURL`/`authToken` 是否随模型切换正确切换
2. **记忆 (Memory) 加载**：切换模型后历史上下文是否仍能正确加载
3. **会话连续性**：`resume` 机制在跨 provider 切换时是否正常工作

### Claude Code CLI vs Claude Agent SDK 的区别

`cc switch` 在本地 CLI 中正常工作的原因与 SDK 的 resume 机制有本质区别：

| 特性 | Claude Code CLI（本地终端） | Claude Agent SDK（`query()`） |
|------|--------------------------|------------------------------|
| **进程模型** | 单个持久进程，一次启动持续运行 | 每次 `query()` 调用**新建子进程** |
| **模型切换方式** | `/switch-model` 命令，同进程内切换 | 新进程传入 `--model <新模型>` |
| **会话状态** | 在进程内存中保持 | 从磁盘文件加载 (`--resume <sessionId>`) |
| **执行方式** | 交互式 TTY | 非交互式 stdin/stdout 管道 |

**本质差异：** `cc switch` 是在一个永不退出的 `claude` 进程中切换模型。而 SDK 每次 `query()` 调用都会执行 `node cli.js --output-format stream-json --verbose --model <model> --resume <sessionId> --permission-mode ...`，CLI 加载旧会话文件、发 API 请求、返回结果、**然后进程退出**。下次调用又是一个新进程。

这意味着 SDK resume 能否正常工作取决于：**`cli.js --model <不同模型> --resume <sessionId>` 这个命令是否支持用新模型恢复旧会话。**

### 测试脚本 Bug 说明

初始测试脚本 `scripts/test-cross-provider-switch.mjs` 存在一个 Bug：

测试脚本监听的是 `session_start` 消息来获取 sessionId，但：

| WebSocket 消息 | 包含的 sessionId | 说明 |
|---------------|-----------------|------|
| `session_start` | **临时 sessionId**（后端 `uuidv4()` 生成） | 仅用于请求追踪 |
| `session-created` | **真实 sessionId**（SDK/CLI 返回） | 这才是磁盘上会话文件的 ID |

前端正确处理了这个问题（见 `frontend/features/chat/services/sessionStateManager.ts`）：
- 收到 `session-created` 后，自动用真实 sessionId 替换临时 sessionId
- `currentSessionId` 始终持有真实 sessionId
- `session_start` 仅日志记录，不做 sessionId 更新

测试脚本只监听了 `session_start`，导致 resume 请求发送了错误的临时 sessionId。这意味着测试 2-5 的失败**不一定是 SDK/CLI 的问题**，也可能是测试脚本 bug 导致"找不到会话文件"。

### 验证工具

| 项目 | 详情 |
|------|------|
| **测试脚本** | `scripts/test-cross-provider-switch.mjs`（含测试脚本 Bug） |
| **验证方式** | WebSocket 直连，模拟前端消息发送 |
| **日志检查** | Docker 日志确认 provider 配置变化 |
| **SDK 源码分析** | `/app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs` |

### SDK CLI 参数构造（源码分析）

SDK 内部构造的 CLI 参数顺序（来自 `sdk.mjs` 源码）：

```javascript
u = [
  "--output-format", "stream-json",
  "--verbose",
  "--input-format", "stream-json",
  // ... thinking/effort/max-turns ...
  "--model", modelName,           // ← options.model
  // ... agent/betas ...
  "--continue",                   // ← options.continue 时
  "--resume", sessionId,          // ← options.resume 时
  "--permission-mode", mode,
  "--allow-dangerously-skip-permissions",  // ← 允许时
  "--session-id", sessionId,      // ← options.sessionId 时
  // ...
]
```

关键发现：当同时设置 `resume` 和 `sessionId` 时，SDK 会**同时传递 `--resume` 和 `--session-id`** 给 CLI。但后端 `sdkOptionCleaner.js` 的 `handleResumeParam()` 在设置 `sdkOptions.resume` 后会 `delete sdkOptions.sessionId`，所以实际 CLI 只收到 `--resume <真实sessionId>`。

### 测试序列

| # | 操作 | 模型 | Provider | 期望 |
|---|------|------|----------|------|
| 1 | 新会话 | `claude-sonnet-4-5-20250929-thinking` | Laozhang | 首次发起对话 |
| 2 | Resume, 切换模型 | `claude-sonnet-4-6-thinking` | Laozhang（同一 provider） | 切换后继续对话 |
| 3 | Resume, 跨 provider | `gpt-5.5` | Claude Adapter | 跨 provider 切换 |
| 4 | Resume, 跨 provider | `kimi-k2.6` | Moonshot AI | 再次跨 provider 切换 |

### 测试结果

| # | 测试项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 新会话（Laozhang sonnet-4-5） | ✅ 通过 | exitCode=0，6 chunks 完整响应 |
| 2 | Resume, 同一 provider 切换（sonnet-4-6） | ⚠️ 不确定 | SDK exit code 1，但测试脚本用了**错误**(临时)的 sessionId |
| 3 | Resume, 跨 provider 切换（gpt-5.5 / Claude Adapter） | ⚠️ 不确定 | 同上，sessionId 错误 |
| 4 | Resume, 跨 provider 切换（kimi-k2.6 / Moonshot AI） | ⚠️ 不确定 | 同上，sessionId 错误 |
| 5 | Resume, 同一模型（对比基线） | ⚠️ 不确定 | 同上，sessionId 错误 |

### 日志分析

**Docker 日志确认（后端逻辑正确 ✅）：**

```
[ClaudeQuery] modelName: "claude-sonnet-4-5-20250929-thinking", providerBaseURL: "https://api.laozhang.ai"
[ClaudeQuery] modelName: "claude-sonnet-4-6-thinking", providerBaseURL: "https://api.laozhang.ai"
[ClaudeQuery] modelName: "gpt-5.5", providerBaseURL: "http://host.docker.internal:3080"
[ClaudeQuery] modelName: "kimi-k2.6", providerBaseURL: "https://guanghua-api.bj33smarter.com/anthropic"
```

**Session & Memory 加载（正确 ✅）：**

```
[ClaudeQuery] resume session: <sessionId>
[Memory] Memory context summary (588 chars): ...
```

**SDK 执行日志（exit code 1，但可能因测试脚本 sessionId 错误 ❌）：**

```
[SDK] Received chunk #1 type=result
claude CLI child process exited with code 1
[ClaudeQuery] Claude Code process exited with code 1
```

### 对比测试：直接运行 CLI + --resume

直接运行 CLI 验证 resume 行为：

```bash
# 使用正确 sessionId + 正确 cwd 时 → 需要进一步测试
node cli.js --resume <realSessionId> --model <model> \
  --cwd /workspace/my-workspace --permission-mode default

# 使用错误 sessionId 时 → exit code 1，session not found
node cli.js --resume <wrongSessionId> --model <model> ...
# 返回: {"is_error":true, "errors":["No conversation found with session ID: xxx"]}
```

### 结论与根因分析

| 维度 | 结论 |
|------|------|
| **Provider 配置解析** | ✅ **正确** — 模型→provider→baseURL/authToken 映射无误 |
| **环境变量传递** | ✅ **正确** — `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` 随模型切换正确变化 |
| **记忆 (Memory) 加载** | ✅ **正确** — memory context 在每个会话中正确加载 |
| **测试脚本 sessionId** | ❌ **测试脚本 Bug** — 使用了临时 sessionId（来自 `session_start`），应使用真实 sessionId（来自 `session-created`） |
| **SDK resume 机制** | ⚠️ **待定** — 因测试脚本 Bug 无法确定 resume 是否正常工作。需修正脚本后重测 |
| **cc switch 功能** | ⚠️ **待定** — 本地 CLI cc switch 正常（单进程模式），SDK 的 `--resume + --model <不同模型>` 需进一步验证 |

### 影响范围

| 功能 | 影响 |
|------|------|
| 新会话（任意模型/任意 provider） | ✅ 正常工作 |
| Resume 会话（生产环境前端流程） | ✅ **前端正确处理** — `session-created` 替换为真实 sessionId |
| Resume 会话（测试脚本） | ⚠️ 测试脚本需修正 sessionId 捕获逻辑 |
| 跨 provider 切换 | ⚠️ 需修正测试后重测 |

### 待办事项

1. **修正测试脚本**：`scripts/test-cross-provider-switch.mjs` 需监听 `session-created` 而非 `session_start` 来获取真实 sessionId
2. **重测 resume**：用正确的 sessionId 重测 resume（同一模型 + 不同模型 + 不同 provider）
3. **确认 cc switch 在 SDK 层的支持**：`cli.js --resume <sessionId> --model <不同模型>` 的行为需确认
4. **文档更新**：记录 Claude Code CLI 与 SDK 的 resume 机制差异

---

## 八、附录

### A. 测试脚本用法

**快捷命令（推荐，已注册到 package.json）：**

```bash
# 方案 A：OpenRouter（需先设置 OPENROUTER_API_KEY 和 HTTP_PROXY）
npm run test:gpt:openrouter

# 方案 B：Claude Bridge（需先启动 npx claude-bridge）
npm run test:gpt:bridge

# 方案 C：Claude Adapter（需先启动 claude-adapter）
npm run test:gpt:adapter

# GPT 工具参数准确性（与 Claude 基线对比，需先设置 OPENROUTER_API_KEY）
npm run test:gpt:accuracy
```

**完整命令（手动设置所有环境变量）：**

```bash
# 测试 OpenRouter（带 VPN 代理）
HTTP_PROXY=http://127.0.0.1:7897 \
HTTPS_PROXY=http://127.0.0.1:7897 \
OPENROUTER_API_KEY=sk-or-v1-xxxxx \
TEST_MODEL=openai/gpt-4o \
node scripts/test-openrouter-gpt.mjs

# 测试 Claude Bridge
ADAPTER_BASE_URL=http://localhost:8080/v1 \
  ADAPTER_API_KEY=sk-any \
  TEST_MODEL=gpt-4o \
  node scripts/test-claude-bridge.mjs

# 测试 Claude Adapter
ADAPTER_BASE_URL=http://localhost:3080 \
  ADAPTER_API_KEY=default-key \
  TEST_MODEL=gpt-4o \
  node scripts/test-claude-adapter.mjs

# 测试 Claude Adapter（带 SSE 调试输出）
TEST_DEBUG=true \
  ADAPTER_BASE_URL=http://localhost:3080 \
  ADAPTER_API_KEY=default-key \
  TEST_MODEL=gpt-4o \
  node scripts/test-claude-adapter.mjs
```

**方案 D 测试命令（Claude Adapter + One-API 新加坡）：**

```bash
# 测试 1：One-API 直连（OpenAI 协议，7 项）
ONE_API_BASE_URL=https://api.hk33smarter.com/v1 \
ONE_API_KEY=sk-xxx \
TEST_MODEL=gpt-5.2 \
node 接入openai类模型测试/测试脚本/test-one-api-direct.mjs

# 测试 2：端到端（Anthropic 协议 → Claude-Adapter → One-API，5 项）
# 前提：Claude-Adapter 已启动且上游配置为 One-API
ADAPTER_BASE_URL=http://localhost:3080/v1 \
ADAPTER_API_KEY=default-key \
TEST_MODEL=gpt-5.2 \
node 接入openai类模型测试/测试脚本/test-one-api-e2e.mjs
```

### B. 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TEST_MODEL` | 模型名称 | `openai/gpt-5.5`（OpenRouter）/ `gpt-5.2`（One-API） |
| `OPENROUTER_API_KEY` | OpenRouter 密钥 | - |
| `HTTP_PROXY` / `HTTPS_PROXY` | 代理地址（用于宿主机 VPN） | - |
| `ADAPTER_BASE_URL` | 本地翻译代理地址 | `http://localhost:8080/v1`（旧脚本）/ `http://localhost:3080/v1`（新脚本） |
| `ADAPTER_API_KEY` | 本地翻译代理密钥 | `sk-any`（旧脚本）/ `default-key`（新脚本） |
| `ONE_API_BASE_URL` | One-API 端点地址 | `https://api.hk33smarter.com/v1` |
| `ONE_API_KEY` | One-API 密钥 | - |
| `TEST_DEBUG` | 设置后打印原始 SSE chunk（新脚本专用） | - |

### C. CC Switch 与当前架构兼容性分析

> **分析日期**：2026-05-22
> **分析方法**：阅读 CC Switch 源码（provider_router.rs、model_mapper.rs、handler_config.rs、forwarder.rs、server.rs、handler_context.rs、session.rs）+ 官方路由文档

#### CC Switch 的路由机制（源码分析）

CC Switch 的 Local Proxy 基于 Axum HTTP 服务器，监听端口 `15721`，**按 `app_type` 维度独立路由**：

| app_type | 请求路径 | 来源 CLI |
|----------|----------|----------|
| `"claude"` | `/v1/messages` | Claude Code CLI |
| `"codex"` | `/v1/chat/completions` 或 `/v1/responses` | Codex CLI |
| `"gemini"` | `/v1beta/models/...` | Gemini CLI |

**路由逻辑**（来自 `provider_router.rs`）：

```rust
pub async fn select_providers(&self, app_type: &str) -> Result<Vec<Provider>>
```

- **故障转移关闭时**：每个 app_type 只使用一个固定的 `current_provider`
- **故障转移开启时**：按 failover queue 顺序依次尝试（P1 → P2 → ...），配合熔断器状态
- **多 app_type 并发**：完全独立，Claude 用 Provider A，Codex 用 Provider B，互不干扰

**模型映射**（来自 `model_mapper.rs`）：

CC Switch 支持在**单个 Provider 内**做模型名替换：
```rust
if model_lower.contains("sonnet") → provider.sonnet_model
if model_lower.contains("haiku")   → provider.haiku_model
if model_lower.contains("opus")    → provider.opus_model
default → provider.default_model
```

但这只是在**一个 Provider** 内做模型名替换（如把 "claude-sonnet-4-5" 替换成 "deepseek-v4-pro"），不是多 Provider 路由。所有请求还是走同一个上游 baseURL。

#### 与我们架构的对比

我们的后端 `modelConfig.js:189-208` 是**按模型名动态路由到不同 Provider**：

```
用户A选 gpt-5.5 → getModelProviderConfig("gpt-5.5") → provider="Claude Adapter" → baseURL=http://host.docker.internal:3080
用户B选 kimi-k2.6 → getModelProviderConfig("kimi-k2.6") → provider="Moonshot AI" → baseURL=https://guanghua-api.bj33smarter.com/anthropic
```

每个用户的 SDK 进程拿到的 `ANTHROPIC_BASE_URL` 是各自独立的，互不干扰。

| 维度 | 我们的架构 | CC Switch |
|------|-----------|-----------|
| **路由粒度** | 模型名 → Provider（细粒度） | app_type → Provider（粗粒度） |
| **路由方式** | 后端 modelConfig.js 按模型分配不同 baseURL | Proxy 按 CLI 工具类型选择 Provider 链 |
| **多模型→多 Provider** | 支持（不同模型可走不同 baseURL） | **不支持** — 同一 app_type 只能配一个 Provider 链 |
| **故障转移** | 无 | 有（熔断器 + failover queue） |
| **格式转换** | 由 Claude Adapter 完成 | 内置（Anthropic ↔ OpenAI ↔ Gemini） |
| **用量统计** | 无 | 有 |
| **部署方式** | Node.js 服务，可多实例 | 桌面 GUI，单实例 |

#### 核心矛盾

**所有用户的请求都走 Claude SDK → Anthropic Messages API → `/v1/messages`**

从 CC Switch 的视角看，我们所有用户的请求都属于 `app_type = "claude"`。CC Switch 无法区分"这个 `/v1/messages` 请求是要 GPT 还是 Kimi"，它只会统一转发给 `app_type="claude"` 对应的那一个 Provider 链。

场景分析：

| # | 场景 | CC Switch 是否兼容 |
|---|------|-------------------|
| 1 | 所有用户都用 Claude 模型 | ✅ 完美匹配 |
| 2 | 混合使用 Claude CLI + Codex CLI | ✅ 按 app_type 独立路由，无冲突 |
| 3 | 同一 CLI 下所有用户用同一个非 Claude Provider（如全部走 OpenRouter） | ✅ 模型映射覆盖 |
| 4 | **同一 CLI 下不同用户需要不同 Provider（用户A要 GPT，用户B要 Kimi）** | ❌ **不支持 — 这是我们的当前架构** |

#### 结论

| 方案 | 可行性 | 说明 |
|------|--------|------|
| CC Switch 完全替代 Claude Adapter | ❌ | 同一 app_type 下无法按模型名路由到不同 Provider |
| CC Switch 作为"一个 Provider 的翻译层" | ✅ | 在 modelConfig.js 中把 CC Switch 地址配置为某 Provider 的 baseURL，等同于 Claude Adapter 的角色 |
| CC Switch + Claude Adapter 混合 | ✅ | CC Switch 管理 Claude 原生 Provider（故障转移+用量统计），Claude Adapter 继续代理 GPT 类模型，两者互补 |

**推荐：继续使用当前架构（Claude Adapter + modelConfig.js 按模型路由），CC Switch 的路由功能在多用户场景下无法替代 modelConfig.js 的按模型路由。如果想引入 CC Switch，只能把它当作"单个 Provider 翻译层"使用。**

#### 补充分析：并发场景与协议支持

**并发安全性：多用户选同一模型不会出错**

CC Switch 基于 Axum HTTP 服务器，天然支持并发。两个用户同时选 gpt-5.5 时：

```
用户A: POST /v1/messages { model: "gpt-5.5", messages: [...] }
用户B: POST /v1/messages { model: "gpt-5.5", messages: [...] }
```

每个请求有独立的 TCP 连接和 SSE 流，互不干扰，与 Nginx 处理并发请求同理。上游 API（如老张 API）也天然支持并发。唯一限制是 CC Switch 为单实例桌面应用，无法多实例扩容，但正常多用户并发量（几个到十几个）完全没问题。

**模型映射配置对并发的影响**

CC Switch 的 `model_mapper.rs` 在 Provider 配置中通过 `ANTHROPIC_MODEL` 环境变量设置 `default_model`。当 gpt-5.5 和 gpt-4o 都不匹配 haiku/sonnet/opus 时，两者都会走 `default_model` 分支：

| `ANTHROPIC_MODEL` 配置 | gpt-5.5 结果 | gpt-4o 结果 | 是否冲突 |
|-------------------------|-------------|-------------|---------|
| **未设置** | `gpt-5.5`（原样透传） | `gpt-4o`（原样透传） | ✅ 不冲突 |
| `ANTHROPIC_MODEL=gpt-4o` | `gpt-4o`（被映射） | `gpt-4o`（被映射） | ❌ 两个模型变成同一个 |
| `ANTHROPIC_MODEL=gpt-5.5` | `gpt-5.5`（被映射） | `gpt-5.5`（被映射） | ❌ 两个模型变成同一个 |

**正确配置：不设置 `ANTHROPIC_MODEL`，让 CC Switch 原样透传模型名给上游 API。** 此时 `has_mapping()` 返回 false，整个映射逻辑被跳过，请求体中的 model 字段原样不动。

**协议格式支持**

CC Switch **支持多种协议格式翻译**（Anthropic ↔ OpenAI ↔ Gemini），并非只支持单一协议。在 `app_type="claude"` 下，Provider 可配 `api_format=anthropic`（透传）或 `api_format=openai_chat`（翻译成 OpenAI 格式）。但问题在于：同一 `app_type` 下的多个 Provider 是 **failover 队列（备胎关系）**，不是按模型名选择的**分工关系**。

```
我们的架构：请求中的 model 字段 → 决定走哪个 Provider（分工关系）
CC Switch：  app_type 固定 → failover 队列顺序决定（备胎关系）
```

因此 CC Switch 不能替代 modelConfig.js 的按模型路由，但作为单个 Provider 翻译层使用时完全可行 — 只给 GPT 类模型配 CC Switch，Claude/Kimi 模型走各自的 baseURL，不经过 CC Switch。

#### CC Switch 替代 Claude Adapter 的实际配置

在 modelConfig.js 中把 CC Switch 配为一个 Provider，只给 GPT 类模型使用：

```bash
# .env.deploy
PROVIDER_CC_SWITCH_BASE_URL=http://host.docker.internal:15721
PROVIDER_CC_SWITCH_API_KEY=<CC Switch 的 gateway token>
AVAILABLE_MODELS=...|gpt-4o:CC Switch|gpt-5.5:CC Switch|claude-sonnet-4-5:Laozhang|kimi-k2.6:Moonshot AI
```

CC Switch 内部 Provider 配置要点：
- `ANTHROPIC_BASE_URL` → 老张 API 的 OpenAI 端点（如 `https://api.laozhang.ai/v1`）
- `ANTHROPIC_API_KEY` → 老张 API 密钥
- `ANTHROPIC_MODEL` → **不设置**（留空，让模型名原样透传）
- `api_format` → `openai_chat`（将 Anthropic 格式翻译为 OpenAI 格式）

---

### D. 项目配置参考

```bash
# .env.deploy（OpenRouter 方案，依赖宿主机 VPN）
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api
PROVIDER_OPENROUTER_API_KEY=sk-or-v1-xxxxx
AVAILABLE_MODELS=...|openai/gpt-5.5:OpenRouter

# .env.deploy（Claude Adapter + 老张 API 方案，无需 VPN）
# 前置条件：宿主机启动 Claude Adapter: claude-adapter
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-4o:Claude Adapter|gpt-5.5:Claude Adapter

# .env.deploy（Claude Adapter + One-API 新加坡方案，推荐 ⭐）
# 前置条件：宿主机启动 Claude Adapter，上游配置为 One-API 新加坡
# ~/.claude-adapter/config.json 中 baseUrl 设为 https://api.hk33smarter.com/v1
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-5.2:Claude Adapter|gpt-5.4:Claude Adapter
```

```javascript
// DockerExecutor.js（容器代理注入）
env: {
  HTTP_PROXY: 'http://host.docker.internal:7897',
  HTTPS_PROXY: 'http://host.docker.internal:7897',
  NO_PROXY: 'localhost,127.0.0.1,.local,host.docker.internal,api.laozhang.ai,guanghua-api.bj33smarter.com'
}
// 注：
// 1. host.docker.internal 必须在 NO_PROXY 中，否则 SDK 会通过 Clash 代理
//    连接 Claude Adapter（本地地址经过代理会导致 ECONNREFUSED）
// 2. 国内 API 域名（api.laozhang.ai、guanghua-api.bj33smarter.com）必须加入
//    NO_PROXY，它们不需要走 Clash 代理；强行走代理会导致 ECONNREFUSED
```
