# GPT 模型接入技术方案

> **文档版本**：v2.0
> **创建日期**：2026-05-19
> **最后更新**：2026-05-27
> **文档性质**：技术方案 + 验证记录（合并版）
> **合并来源**：
> - `GPT模型接入方案对比报告.md` (v1.7)
> - `GPT模型接入验证记录.md` (v1.6)
> - `技术方案验证文档.md`

---

## 一、背景与目标

### 1.1 问题定义

在**不修改 Claude Agent SDK 调用代码**的前提下，让 Claude Code UI 支持 GPT 模型。

### 1.2 核心架构

```
Claude Agent SDK (Anthropic 格式)
  → 协议翻译层 (Anthropic ↔ OpenAI)
  → 目标模型 API (GPT 等)
```

关键约束：SDK 只能发送 Anthropic Messages API 格式（`/v1/messages`），而 GPT 等模型使用 OpenAI Chat Completions 格式（`/v1/chat/completions`）。两者在消息结构、工具调用格式、流式事件等方面完全不同，必须通过中间翻译层进行协议转换。

### 1.3 验证环境

| 项目 | 详情 |
|------|------|
| **宿主机** | macOS, Docker Desktop |
| **VPN** | Clash Verge (端口 7897, Allow LAN 已开启) |
| **测试脚本** | `scripts/test-openrouter-gpt.mjs` |
| **SDK 版本** | `@anthropic-ai/claude-agent-sdk@0.2.59` |

---

## 二、测试方法论

### 2.1 测试分层设计

测试分为两层，因为**失败原因和修复方式完全不同**：

| 层级 | 失败意味着 | 修复方式 |
|------|-----------|---------|
| **翻译层测试** | 翻译代理代码有 Bug | 开发者可修 |
| **模型准确性测试** | 模型能力不足 | 只能换模型或等更新 |

---

### 2.2 翻译层测试（5 项）

测试中间代理（OpenRouter / Claude Bridge / Claude Adapter）在做 Anthropic ↔ OpenAI 格式转换时，是否引入 Bug。

| # | 测试项 | 验证目标 | 背后风险 |
|---|--------|---------|---------|
| 1 | 基本对话 | 能否发请求、收响应 | 翻译层可能完全不工作（路由、认证出错） |
| 2 | 流式对话 | SSE 流式分块是否正确 | 翻译层可能只转发了 HTTP 但没正确转发流 |
| 3 | 工具调用（非流式） | 能否把 Anthropic tools 参数正确转成 OpenAI functions | OpenAI 和 Anthropic 的 tool 格式不一样，翻译错就调不了工具 |
| 4 | 工具结果回传 | 多轮对话中 ID 映射是否正确 | Anthropic ID 是 `toolu_xxx`，OpenAI 是 `call_xxx`，映射断裂则第二轮报 400 |
| 5 | 流式工具调用 | 流式中 tool 参数增量传输能否正确拼接 | `input_json_delta` → `function.arguments`，增量流式翻译是最容易丢数据的 |

> 这 5 项覆盖了翻译层的所有关键路径。一项不过，翻译层就不能用于生产。

---

### 2.3 模型准确性测试（6 项）

翻译层通过后，还需确认 GPT 模型能否正确使用 SDK 的实际工具 Schema（非简单的 `get_weather`）。

| # | 测试项 | 为什么选这个工具 | 核心检查点 |
|---|--------|---------------|-----------|
| 1 | Read pages 参数 | 生产中发现 GPT 传了 `pages=""` | 空字符串 vs 合法格式 `"3-8"` |
| 2 | Grep 多参数组合 | Grep 有 15 个参数，最复杂的工具 | 参数类型（`-i` 应为 boolean）、枚举值（`output_mode` 只能 3 种）、边界（`head_limit` 应为正整数） |
| 3 | Edit 必填参数完整性 | Edit 要求 3 个必填参数 | 模型是否漏传必填参数、`new_string` 和 `old_string` 是否不同 |
| 4 | Bash 参数类型 | `timeout` 单位、boolean 类型参数 | `timeout` 不能传字符串、`run_in_background` 应为 boolean |
| 5 | WebSearch 数组参数 | 需要传数组类型 | 能否正确构造 `allowed_domains: ["github.com"]` 而非字符串 |
| 6 | Read 不带可选参数 | 检查模型是否"发明"不存在的参数 | 读 `/etc/hosts` 时不应该传 `pages` 或 `offset` |

> 这 6 项覆盖了 SDK 工具参数的所有类型风险——字符串 vs 数字 vs 布尔 vs 枚举 vs 数组 vs undefined。

---

## 三、方案验证详情

### 3.1 方案 A：OpenRouter + VPN（评分 3.85/5）

#### 架构

```
SDK (容器内) → 宿主机 Clash VPN → OpenRouter 翻译层 → GPT API
```

#### 前提条件

1. 宿主机安装 Clash Verge（或其他 VPN 客户端）
2. Clash Verge 开启 **「允许局域网连接」(Allow LAN)**
3. `DockerExecutor.js` 注入代理环境变量：

```javascript
env: {
  HTTP_PROXY: 'http://host.docker.internal:7897',
  HTTPS_PROXY: 'http://host.docker.internal:7897',
  NO_PROXY: 'localhost,127.0.0.1,.local'
}
```

#### 验证结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | GPT-4o/Mistral 等模型正常响应 |
| 流式对话 | ✅ 通过 | SSE 分块正确 |
| 工具调用（非流式） | ✅ 通过 | tool_use 参数完整 |
| 工具结果回传 | ✅ 通过 | 多轮循环正常 |
| 流式工具调用 | ✅ 通过 | 流式中 tool_use 块完整，无数据丢失 |

#### 环境配置

```bash
# .env.deploy
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api
PROVIDER_OPENROUTER_API_KEY=sk-or-v1-xxxxx
AVAILABLE_MODELS=...|openai/gpt-4.1:OpenRouter|openai/gpt-4o:OpenRouter|openai/gpt-5.5:OpenRouter
```

#### 结论

| 维度 | 结论 |
|------|------|
| 协议翻译 | ✅ 5 项全过 |
| 流式工具调用 | ✅ 无数据丢失 |
| 区域限制 | ⚠️ 依赖宿主机 VPN，VPN 中断则 GPT 不可用 |
| 代码改动 | 极小（DockerExecutor.js 加 3 行 env） |

---

### 3.2 方案 B：Claude Bridge + 老张 API（不可用）

#### 架构

```
SDK (本机) → Claude Bridge (localhost:8080, 协议翻译) → 老张 API (国内直连) → GPT-4o
```

#### 验证结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | 老张 API 直连 GPT-4o 正常 |
| 流式对话 | ❌ 失败 | 流式翻译有问题，未收到有效 chunk |
| 工具调用（非流式） | ✅ 通过 | `get_weather` 工具调用正确 |
| 工具结果回传 | ❌ 失败 | `tool_use` ID 格式不匹配（`toolu_*` vs `call_*`） |
| 流式工具调用 | ❌ 失败 | 流式 SSE 中未解析到 tool_use 块 |

#### 失败根因

**工具结果回传 400 错误**：

```
An assistant message with 'tool_calls' must be followed by tool messages
responding to each 'tool_call_id'. The following tool_call_ids did not have
response messages: call_2Jz3bu3mPMsO7wbZV9YGF27m
```

Claude Bridge 在翻译多轮消息时，Anthropic 的 `tool_use.id`（`toolu_*`）和 OpenAI 的 `tool_call_id`（`call_*`）之间的 ID 映射断裂。第一轮返回的 `tool_call_id` 在第二轮消息中没有被正确回传。

#### 结论

| 维度 | 结论 |
|------|------|
| 老张 API 本身 | ✅ GPT 模型可正常调用 |
| Claude Bridge 翻译 | ❌ 流式和多轮工具调用有 Bug |
| 可用性 | ❌ 不可用于生产（流式 + 多轮工具调用是核心场景） |

---

### 3.3 方案 C：Claude Adapter + 老张 API（评分 4.0/5）

#### 项目信息

| 项目 | 详情 |
|------|------|
| 仓库 | https://github.com/shantoislamdev/claude-adapter |
| 安装 | `npm install -g claude-adapter` |
| 启动 | `claude-adapter`（交互式配置） |
| 默认端口 | 3080 |
| 翻译方向 | 双向（Anthropic ↔ OpenAI） |

#### 架构

```
SDK (本机) → Claude Adapter (localhost:3080, 协议翻译) → 老张 API → GPT
```

#### 验证结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | `gpt-4o` 通过老张 API 直连，响应正常 |
| 流式对话 | ✅ 通过 | SSE 分块正确，`message_start`/`message_stop` 事件完整 |
| 工具调用（非流式） | ✅ 通过 | `get_weather` 工具调用正确，参数完整 |
| 工具结果回传 | ✅ 通过 | 多轮对话正常，ID 映射翻译正确 |
| 流式工具调用 | ✅ 通过 | `input_json_delta` 翻译正确，无数据丢失 |

#### 补充验证：完整 Docker 集成 ✅

验证时间：2026-05-20

```
前端 (浏览器) → WebSocket → 后端 (Express) → Docker 沙箱 → SDK → Claude Adapter (宿主机:3080) → 老张 API → GPT-5.5
```

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 基本对话 | ✅ 通过 | "你好吗" → GPT 回复"我很好，谢谢！" |
| 交底书生成 | ✅ 通过 | 完整生成技术交底书，47 chunks，17,265 tokens |
| 容器内网络 | ✅ 通过 | `host.docker.internal:3080` 可直达 |
| 代理隔离 | ✅ 通过 | `host.docker.internal` 已加入 `NO_PROXY` |
| 多轮对话 | ✅ 通过 | 含工具调用的复杂场景正常 |

#### 已知缺点

| # | 缺点 | 说明 |
|---|------|------|
| 1 | 模型映射不可控 | SDK 内部将模型名映射到 opus/sonnet/haiku，逻辑不透明 |
| 2 | 单点故障 | Claude Adapter 是宿主机独立进程，挂了则所有 GPT 不可用 |
| 3 | 无监控与日志持久化 | 日志仅输出到终端 |
| 4 | 协议翻译延迟 | 多一层 HTTP 转发（实测 TTFT ~2s，可接受） |
| 5 | 仅适合单机部署 | 多台宿主机需独立安装维护 |

#### 结论

| 维度 | 结论 |
|------|------|
| 协议翻译 | ✅ Docker → SDK → Claude Adapter → 老张 API 完整链路正常 |
| 流式工具调用 | ✅ 47 chunks 含多轮工具调用，完整无错误 |
| SDK 兼容性 | ✅ 通过 `options.model` 传递模型名 |
| 生产可用性 | ✅ 可用，建议配置守护进程防单点故障 |
| 模型扩展 | ✅ 新增模型仅需改 `.env.deploy`，无需改代码 |

---

### 3.4 方案 D：Claude Adapter + One-API 新加坡（评分 4.0/5）

#### 背景

方案 C 在实际使用中暴露以下问题：
1. 老张 API 为个人维护服务，稳定性和 SLA 无法保障
2. 部分模型（如 gpt-5.5）在老张 API 上不可用
3. Docker 容器内调用时出现 `max_output_tokens: 0` 错误

经调研发现公司有新加坡节点的 One-API 服务（`api.hk33smarter.com`），提供 228 个模型（含 69 个 GPT/OpenAI 系列），且**国内直连无需 VPN**。

#### 架构

```
Docker 容器 (Claude Agent SDK)
  ↓ ANTHROPIC_BASE_URL=http://host.docker.internal:3080
Claude-Adapter (宿主机 :3080, 协议翻译 Anthropic → OpenAI)
  ↓ https://api.hk33smarter.com/v1/chat/completions
One-API 新加坡节点 (腾讯云)
  ↓ 内部路由
OpenAI GPT-5.2 / GPT-5.4
```

#### 前提条件

1. Claude-Adapter 已安装并启动（端口 3080）
2. Claude-Adapter 上游配置为 One-API：

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

3. **无需 VPN**

#### 测试一：One-API 直连（7 项全过 ✅）

验证 One-API 端点本身的连通性和功能完整性。

| # | 测试项 | 结果 | 备注 |
|---|--------|------|------|
| 0 | 网络连通性 | ✅ | DNS `43.153.222.253`，TCP 561ms |
| 1 | 模型列表 | ✅ | 228 个模型，69 个 GPT 系列 |
| 2 | 基本对话（非流式） | ✅ | 响应 2.9s |
| 3 | 流式对话 | ✅ | 12 chunks，2.7s |
| 4 | Tool Calling（非流式） | ✅ | `get_weather` 参数完整 |
| 5 | Tool Calling 多轮 | ✅ | 工具结果回传正常 |
| 6 | 流式 Tool Calling | ✅ | delta 完整解析 |

**关键发现**：GPT-5.x 流式请求必须使用 `max_completion_tokens` 而非 `max_tokens`，否则返回 400。

#### 测试二：端到端（5 项全过 ✅）

验证完整链路的协议翻译和工具调用。

| # | 测试项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 基本对话（非流式） | ✅ | Anthropic → OpenAI 翻译正确 |
| 2 | 流式对话 | ✅ | SSE 事件完整 |
| 3 | 工具调用（非流式） | ✅ | ID 格式 `call_*`（非 `toolu_*`） |
| 4 | 工具结果回传 | ✅ | ID 映射正确 |
| 5 | 流式工具调用 | ✅ | `input_json_delta` 翻译完整 |

#### 已知问题：Claude-Adapter `max_tokens=0` Bug

**现象**：Docker 容器内通过 SDK 调用时：

```
Error: API Error: 400 {"error":{"type":"invalid_request_error",
"message":"Invalid 'max_output_tokens': integer below minimum value.
Expected a value >= 16, but got 0 instead."}}
```

**根因**：Claude Agent SDK 在某些场景（prompt caching 预热请求、会话初始化）会发送 `max_tokens: 0`。Claude-Adapter 只对 `max_tokens === 1` 做了兜底（改成 32），没覆盖 `max_tokens === 0`。

**问题位置**：`/opt/homebrew/lib/node_modules/claude-adapter/dist/converters/request.js:73`

```javascript
// 当前代码（只处理 max_tokens === 1）
const maxTokens = anthropicRequest.max_tokens === 1 ? 32 : anthropicRequest.max_tokens;

// 应改为（兜底所有小于 16 的值）
const maxTokens = (anthropicRequest.max_tokens < 16) ? 16384 : anthropicRequest.max_tokens;
```

**状态**：待修复。

#### 网络特性

| 指标 | 值 |
|------|-----|
| DNS 解析 | `43.153.222.253`（腾讯云） |
| TCP 连接延迟 | 241ms（国内直连） |
| TTFT（首 token） | ~610ms |
| 需要 VPN | **否** |

#### 环境配置

```bash
# .env.deploy
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-5.2:Claude Adapter|gpt-5.4:Claude Adapter
```

#### 结论

| 维度 | 结论 |
|------|------|
| 协议翻译 | ✅ 5/5 全过 |
| 网络连通 | ✅ 国内直连，无需 VPN，延迟 241ms |
| 模型可用性 | ✅ 228 个模型，含最新 gpt-5.4 |
| 上游稳定性 | ✅ 公司统一运维，优于个人维护的老张 API |
| max_tokens bug | ⚠️ 需修复后可投入生产 |

---

## 四、方案对比与推荐

### 4.1 对比矩阵

| 维度 | A: OpenRouter + VPN | B: Bridge + 老张 | C: Adapter + 老张 | D: Adapter + One-API |
|------|:------------------:|:---------------:|:----------------:|:-------------------:|
| **基本对话** | ✅ | ✅ | ✅ | ✅ |
| **流式对话** | ✅ | ❌ | ✅ | ✅ |
| **工具调用（非流式）** | ✅ | ✅ | ✅ | ✅ |
| **工具结果回传** | ✅ | ❌ | ✅ | ✅ |
| **流式工具调用** | ✅ | ❌ | ✅ | ✅ |
| **需要 VPN** | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| **上游稳定性** | ⚠️ SaaS 第三方 | ⚠️ 个人维护 | ⚠️ 个人维护 | ✅ 公司运维 |
| **模型丰富度** | 中 | 低 | 低 | ✅ 高（228个） |
| **Docker 集成** | ✅ | ❌ | ✅ | ⚠️ 需修复 bug |
| **综合评分** | 3.85/5 | 不可用 | 4.0/5 | **4.5/5** |

### 4.2 关键发现

1. **OpenRouter 翻译层质量可靠**，5 项全过，但依赖 VPN
2. **Claude Adapter 翻译质量与 OpenRouter 相当**，且不依赖特定 SaaS
3. **Claude Bridge 与 Claude Adapter 是不同项目**，翻译质量差异极大（2/5 vs 5/5）
4. **流式 + 工具调用的翻译是普遍技术难点**：OpenRouter 和 Claude Adapter 做到了，Claude Bridge 做不到
5. **One-API 新加坡节点是最佳上游选择**：公司运维、国内直连、无需 VPN、模型丰富

### 4.3 推荐方案排序

| 排名 | 方案 | 评分 | 适用场景 |
|------|------|------|---------|
| **1** | **Claude Adapter + 老张 API** | **4.5/5** | **当前推荐**，无需 VPN |
| 2 | Claude Adapter + One-API 新加坡 | 4.0/5 | 备选，公司运维稳定，模型丰富 |
| 3 | OpenRouter + 宿主机 VPN | 3.85/5 | 备选，依赖 VPN |
| 4 | 海外 VPS + Claude Adapter + OpenAI 直连 | 4.0/5 | 海外部署 |

---

## 五、已知问题与风险

### 5.1 GPT 工具使用质量低于 Claude

生产任务（生成专利文件）中发现：

```
Read 工具报错: Invalid pages parameter: ""
```

GPT 调用 `Read` 工具时传了空字符串 `pages=""`，Claude 原生不会出现此问题。

| 对比项 | Claude 原生 | GPT (通过翻译层) |
|--------|-----------|----------------|
| 协议格式 | ✅ 原生无误 | ✅ 翻译正确 |
| 工具参数准确性 | ✅ 准确 | ⚠️ 偶发参数缺失/错误 |
| 复杂多工具场景 | ✅ 稳定 | ⚠️ 可能随机出错 |

这是**模型能力的固有差异**，不是翻译层可以解决的。GPT 在简单工具场景（如 `get_weather`）表现良好，但在复杂工具链（Read/Write/Edit/Bash 等 18+ 工具）中参数准确性不如 Claude。

### 5.2 Claude-Adapter `max_tokens=0` Bug

详见 [3.4 节已知问题](#34-方案-dclaude-adapter--one-api-新加坡评分-455-推荐)。待修复后重测 Docker 集成。

### 5.3 跨 Provider 模型切换（部分验证）

#### 背景

Claude Code UI 支持在同一会话中切换模型，需验证跨 Provider 切换是否正常。

#### Claude Code CLI vs SDK 的本质区别

| 特性 | Claude Code CLI | Claude Agent SDK |
|------|----------------|-----------------|
| 进程模型 | 单个持久进程 | 每次 `query()` **新建子进程** |
| 模型切换 | `/switch-model`，同进程内 | 新进程传入 `--model` |
| 会话状态 | 进程内存保持 | 从磁盘加载 (`--resume`) |

SDK 每次 `query()` 都执行 `node cli.js --model <model> --resume <sessionId> ...`，然后进程退出。能否跨模型 resume 取决于 CLI 是否支持。

#### 测试结果

| # | 测试项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 新会话（Laozhang sonnet-4-5） | ✅ | exitCode=0，6 chunks 完整响应 |
| 2 | Resume 同 Provider 切换 | ⚠️ 不确定 | 测试脚本使用了错误的临时 sessionId |
| 3 | Resume 跨 Provider 切换 | ⚠️ 不确定 | 同上 |
| 4 | Resume 同模型（基线） | ⚠️ 不确定 | 同上 |

#### 已确认正确的部分

- ✅ **Provider 配置解析**：模型→provider→baseURL/authToken 映射无误
- ✅ **环境变量传递**：`ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` 随模型切换正确变化
- ✅ **Memory 加载**：memory context 正确加载
- ✅ **前端流程**：`session-created` 替换为真实 sessionId，生产环境正常

#### 待办

1. 修正测试脚本 `session_start` → `session-created` 的 sessionId 捕获
2. 重测 resume（同一模型 + 不同模型 + 不同 Provider）
3. 确认 `cli.js --resume <sessionId> --model <不同模型>` 的行为

---

## 六、附录

### A. 测试脚本用法

```bash
# 方案 A：OpenRouter（需 VPN + API Key）
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 \
  OPENROUTER_API_KEY=sk-or-v1-xxxxx \
  node scripts/test-openrouter-gpt.mjs

# 方案 B：Claude Bridge（需先启动 npx claude-bridge -p 8080）
ADAPTER_BASE_URL=http://localhost:8080/v1 ADAPTER_API_KEY=sk-any \
  TEST_MODEL=gpt-4o node scripts/test-claude-bridge.mjs

# 方案 C：Claude Adapter（需先启动 claude-adapter）
ADAPTER_BASE_URL=http://localhost:3080 ADAPTER_API_KEY=default-key \
  TEST_MODEL=gpt-4o node scripts/test-claude-adapter.mjs

# 方案 D：One-API 直连（7 项）
ONE_API_BASE_URL=https://api.hk33smarter.com/v1 ONE_API_KEY=sk-xxx \
  TEST_MODEL=gpt-5.2 node 接入openai类模型测试/测试脚本/test-one-api-direct.mjs

# 方案 D：端到端（5 项）
ADAPTER_BASE_URL=http://localhost:3080/v1 ADAPTER_API_KEY=default-key \
  TEST_MODEL=gpt-5.2 node 接入openai类模型测试/测试脚本/test-one-api-e2e.mjs

# GPT 工具参数准确性（与 Claude 基线对比）
npm run test:gpt:accuracy

# SSE 调试输出
TEST_DEBUG=true ADAPTER_BASE_URL=http://localhost:3080 \
  ADAPTER_API_KEY=default-key TEST_MODEL=gpt-4o \
  node scripts/test-claude-adapter.mjs
```

### B. 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TEST_MODEL` | 模型名称 | `openai/gpt-5.5`（OpenRouter）/ `gpt-5.2`（One-API） |
| `OPENROUTER_API_KEY` | OpenRouter 密钥 | - |
| `HTTP_PROXY` / `HTTPS_PROXY` | 代理地址 | - |
| `ADAPTER_BASE_URL` | 本地翻译代理地址 | `http://localhost:3080/v1` |
| `ADAPTER_API_KEY` | 本地翻译代理密钥 | `default-key` |
| `ONE_API_BASE_URL` | One-API 端点 | `https://api.hk33smarter.com/v1` |
| `ONE_API_KEY` | One-API 密钥 | - |
| `TEST_DEBUG` | 打印原始 SSE chunk | - |

### C. CC Switch 兼容性分析

> **分析日期**：2026-05-22
> **分析方法**：阅读 CC Switch 源码（provider_router.rs、model_mapper.rs 等）+ 官方路由文档

#### C.1 CC Switch 路由机制

CC Switch 基于 Axum HTTP 服务器（端口 `15721`），按 `app_type` 维度独立路由：

| app_type | 请求路径 | 来源 |
|----------|----------|------|
| `"claude"` | `/v1/messages` | Claude Code CLI |
| `"codex"` | `/v1/chat/completions` | Codex CLI |
| `"gemini"` | `/v1beta/models/...` | Gemini CLI |

路由逻辑：故障转移关闭时，每个 app_type 只使用一个固定 Provider；开启时按 failover queue 顺序尝试。

#### C.2 与我们架构的核心矛盾

我们的 `modelConfig.js` 是**按模型名动态路由到不同 Provider**：

```
用户A选 gpt-5.5 → baseURL=http://host.docker.internal:3080
用户B选 kimi-k2.6 → baseURL=https://guanghua-api.bj33smarter.com/anthropic
```

CC Switch 是**按 app_type 路由到固定 Provider 链**，同一 app_type 下无法按模型名区分。

| # | 场景 | CC Switch |
|---|------|-----------|
| 1 | 所有用户都用 Claude | ✅ |
| 2 | 同 CLI 下所有用户用同一 Provider | ✅ |
| **3** | **同 CLI 下不同用户需要不同 Provider** | **❌ 这是我们的架构** |

#### C.3 结论

| 方案 | 可行性 | 说明 |
|------|--------|------|
| CC Switch 完全替代 Claude Adapter | ❌ | 无法按模型名路由 |
| CC Switch 作为单个 Provider 翻译层 | ✅ | 在 modelConfig.js 中配为某 Provider 的 baseURL |
| CC Switch + Claude Adapter 混合 | ✅ | CC Switch 管理 Claude 原生，Adapter 代理 GPT |

**推荐：继续使用当前架构（Claude Adapter + modelConfig.js 按模型路由）。**

#### C.4 CC Switch 替代 Claude Adapter 的实际配置

如果要用 CC Switch 作为 GPT 翻译层：

```bash
# .env.deploy
PROVIDER_CC_SWITCH_BASE_URL=http://host.docker.internal:15721
PROVIDER_CC_SWITCH_API_KEY=<gateway token>
AVAILABLE_MODELS=...|gpt-4o:CC Switch|gpt-5.5:CC Switch|claude-sonnet-4-5:Laozhang
```

CC Switch 内部配置要点：
- `ANTHROPIC_BASE_URL` → 上游 OpenAI 端点
- `ANTHROPIC_MODEL` → **不设置**（留空，原样透传模型名）
- `api_format` → `openai_chat`

---

### D. 项目配置参考

```bash
# --- .env.deploy 配置 ---

# OpenRouter 方案（依赖 VPN）
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api
PROVIDER_OPENROUTER_API_KEY=sk-or-v1-xxxxx
AVAILABLE_MODELS=...|openai/gpt-5.5:OpenRouter

# Claude Adapter + 老张 API（无需 VPN）
PROVIDER_CLAUDE_ADAPTER_BASE_URL=http://host.docker.internal:3080
PROVIDER_CLAUDE_ADAPTER_API_KEY=default-key
AVAILABLE_MODELS=...|gpt-4o:Claude Adapter|gpt-5.5:Claude Adapter

# Claude Adapter + One-API 新加坡（推荐）
# 前置：~/.claude-adapter/config.json 中 baseUrl 设为 https://api.hk33smarter.com/v1
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
// 1. host.docker.internal 必须在 NO_PROXY 中，否则本地地址经代理会 ECONNREFUSED
// 2. 国内 API 域名必须加入 NO_PROXY，它们不需要走 Clash 代理
```

---

### E. Claude-Adapter 部署注意事项

#### E.1 settings.json 冲突问题

**问题**：claude-adapter 启动时会自动改写 `~/.claude/settings.json`，将自身的代理地址写入该文件。而 `settings.json` 恰好是 Claude Code CLI 启动时的**优先读取配置**。这导致两个工具共用同一个配置文件，互相覆盖：

```
claude-adapter 启动 → settings.json 被改写为 claude-adapter 的代理地址
→ Claude Code CLI 启动 → 读取 settings.json → 流量被劫持到 claude-adapter 上游模型
→ 环境变量中的模型配置被忽略
```

**影响**：启动 claude-adapter 后，必须手动修改 `settings.json` 才能正常使用 Claude Code CLI。如果重新启动 claude-adapter，配置又会被覆盖。

#### E.2 解决步骤

**第一步：清空环境变量残留**

```bash
unset ANTHROPIC_MODEL ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY
env | grep ANTHROPIC   # 确认无残留
```

**第二步：恢复 Claude Code CLI 的配置**

```bash
sudo vi ~/.claude/settings.json
```

写入 Claude Code CLI 需要的配置（以下为示例，使用国产模型时填入对应地址）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<your-token>",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

**第三步：跳过 Claude Code CLI 登录检查**

使用国产模型时不需要 Claude 账号登录，但 CLI 启动时会强制检查。通过以下方式绕过：

```bash
echo '{"hasCompletedOnboarding":true}' > ~/.claude.json
```

这会告诉 CLI "已完成引导流程"，跳过登录提示。之后执行 `claude` 即可正常使用。

#### E.3 注意事项

- claude-adapter **每次重启**都会覆盖 `settings.json`，需要在启动后重新写入 Claude Code CLI 的配置
- 使用国产模型时，`ANTHROPIC_AUTH_TOKEN` 中的 token 仅为占位，不会误导 CLI 使用 Claude 付费模型
- 如果 Claude Code CLI 提示使用 opus 模型，说明登录绕过未生效，检查 `~/.claude.json` 是否正确写入
