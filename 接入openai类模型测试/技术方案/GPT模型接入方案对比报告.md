# 技术方案对比报告：Claude Code UI 接入 GPT 模型

> **文档版本**：v1.3
> **创建日期**：2026-05-19
> **最后更新**：2026-05-19
> **决策状态**：已更新（推荐方案变更为 Claude Adapter + 老张 API）
> **关联文档**：[GPT模型接入验证记录](./GPT模型接入验证记录.md)

---

## 一、问题定义

### 1.1 现状

项目采用容器化架构，每个用户拥有独立的 Docker 沙箱容器，容器内安装了 `@anthropic-ai/claude-agent-sdk@0.2.59`，通过以下调用链执行 AI 查询：

```
前端 (WebSocket) → 后端路由 (chat.js) → 容器编排 (ClaudeQuery.js)
→ 脚本生成 (ScriptBuilder.js) → 容器执行 (DockerExecutor.js)
→ SDK 调用 (sdkScriptTemplate.js) → Anthropic Messages API
```

### 1.2 核心约束

| 约束项 | 详情 |
|--------|------|
| **协议绑定** | SDK 脚本硬编码 `import { query } from "@anthropic-ai/claude-agent-sdk/sdk.mjs"`，只认 Anthropic Messages API 格式 |
| **环境变量** | 容器内通过 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 配置端点 |
| **流式响应** | SDK 通过 `for await (const chunk of result)` 迭代，chunk 结构遵循 Anthropic SSE 格式 |
| **工具调用** | 工具链（Bash/Read/Write/Edit/Glob/Grep 等）在容器本地执行，但工具定义和调用指令通过 API 消息传递 |
| **区域限制** | OpenAI API 在中国大陆不可直接访问 |

### 1.3 目标

在**不修改 Claude Agent SDK 调用代码**的前提下，让用户能通过前端选择 GPT 模型并正常使用全部功能（含工具调用、流式响应）。

---

## 二、方案分类

所有方案的本质都是同一种架构模式：

```
┌──────────────┐   Anthropic 协议    ┌──────────────┐                        ┌──────────────┐
│  Claude Agent │  ────────────────→  │  OpenRouter   │  ─── OpenAI 格式 ──→  │   GPT-5.5    │
│  SDK (容器内)  │                    │  翻译层 (SaaS) │                       │  (OpenAI)    │
└──────┬───────┘                     └──────┬───────┘                       └──────────────┘
       │ HTTP_PROXY                           │
       ▼                                      │
┌──────────────┐                              │
│  宿主机 VPN   │  ────── 突破区域封锁 ────────→
│ (Clash Verge) │
└──────────────┘
```

> **OpenRouter 实测架构**：SDK → 容器内代理 → 宿主机 Clash VPN → OpenRouter 翻译层 → GPT API
> **Claude Adapter 实测架构**：SDK → 本机/容器 Claude Adapter (localhost:3080) → 老张 API → GPT API

**区别仅在于：协议翻译层选什么、部署在哪、谁来维护。**

按翻译层形态，可分为三大类：

| 类别 | 方案 | 翻译层形态 |
|------|------|-----------|
| **A. 第三方托管服务** | OpenRouter | SaaS 平台内置翻译 |
| **B. 自建协议代理** | LiteLLM / New-API / CC Switch / Claude Adapter / UniClaudeProxy / Castari Proxy | 用户自建的翻译代理 |
| **C. 代码层改造** | 自行实现双协议路由 | 修改项目代码 |

---

## 三、候选方案详细分析

### 3.1 OpenRouter（SaaS 翻译平台）

**原理**：OpenRouter 提供 "Anthropic Skin"，即一个兼容 Anthropic Messages API 格式的端点，内部自动翻译为目标模型的原生协议。

**接入方式**：配置 `.env.deploy` 中的 provider 信息和 `AVAILABLE_MODELS`，同时在 `DockerExecutor.js` 中注入 HTTP_PROXY 环境变量（因 OpenRouter 需要联网访问，详见 3.1.1）。

```
PROVIDER_OPENROUTER_BASE_URL=https://openrouter.ai/api
PROVIDER_OPENROUTER_API_KEY=sk-or-v1-xxxxx
AVAILABLE_MODELS=...|openai/gpt-4.1:OpenRouter|openai/gpt-4o:OpenRouter
```

**代码改动**：**极少量**（见下方 3.1.1）。

#### 3.1.1 必要代码修改：Docker 容器代理注入

OpenRouter 方案要求容器内 SDK 能访问外网，但容器默认不能访问宿主机 VPN。需要在 `DockerExecutor.js` 的容器 env 中添加代理配置：

```javascript
// backend/services/container/claude/DockerExecutor.js:87
env: {
  // ... 原有配置
  HTTP_PROXY: 'http://host.docker.internal:7897',
  HTTPS_PROXY: 'http://host.docker.internal:7897',
  NO_PROXY: 'localhost,127.0.0.1,.local'
}
```

**前提条件**：宿主机必须安装 VPN 客户端（如 Clash Verge），且开启 **"允许局域网连接"（Allow LAN）**，使 VPN 监听 `0.0.0.0` 而非仅 `127.0.0.1`。

| 评估维度 | 分析 |
|----------|------|
| **工具调用** | 翻译正确，Anthropic `tool_use` ↔ OpenAI `tool_calls` 参数完整 |
| **流式响应** | SSE 流式分块正常，工具调用块的 `input_json_delta` 在流式下完整拼接 |
| **稳定性** | 中等。社区报告 context management 400 错误（本项目未触发，取决于 SDK 版本） |
| **区域限制** | **依赖宿主机 VPN**。需要宿主机安装 Clash Verge 等 VPN 客户端，并开启 Allow LAN |
| **成本** | 按用量付费，OpenRouter 在 OpenAI 原价基础上加收约 10-20% 服务费 |
| **部署复杂度** | **低**。需在宿主机安装 VPN + 修改一处代码（3 行 env） |

**风险**：
- ⚠️ **宿主机 VPN 是硬依赖** — 服务端必须持续运行 VPN，VPN 中断则 GPT 模型不可用
- 协议翻译质量依赖 OpenRouter 维护，不能自主控制
- 第三方服务的可用性 SLA 不受控

---

### 3.2 LiteLLM（开源通用 API 网关）

**原理**：LiteLLM 是 Python 开源的 LLM API 网关，提供 `/v1/messages` 端点接收 Anthropic 格式请求，翻译后转发给任意后端模型。

**接入方式**：
```yaml
# config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

# docker-compose.yml
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4000:4000"]
    command: ["--config", "/app/config.yaml"]
```
```
环境变量：
PROVIDER_LITELLM_BASE_URL=http://litellm-host:4000
PROVIDER_LITELLM_API_KEY=sk-anything
```

**代码改动**：零。

| 评估维度 | 分析 |
|----------|------|
| **工具调用** | **有严重已知 Bug**。GitHub 多个 issue（#12158、#25321、#25561、#25836）报告：流式模式下 `tool_use.input` 参数被丢弃为 `{}`，导致工具调用全部失败。非流式模式正常 |
| **流式响应** | 支持但**不可靠**。OpenAI chunk → Anthropic SSE 翻译层在流式场景下丢失 tool_use 参数 |
| **稳定性** | **非流式模式稳定**，流式 + 工具调用组合不稳定。有修复 PR 但未全面覆盖所有 provider |
| **区域限制** | **可控**。自建在海外 VPS 即可解决 |
| **成本** | 开源免费，只需支付模型 API 费用和 VPS 费用 |
| **部署复杂度** | **中等**。需 Docker 部署 + config 配置 + 海外 VPS |
| **社区生态** | **最大**。GitHub 20k+ stars，文档完善，多语言支持 |

**风险**：
- 流式工具调用是硬伤，而本项目重度依赖流式 + 工具调用
- 作为 workaround 可以关闭流式，但用户体验大幅下降
- Python 项目，资源占用较高

---

### 3.3 New-API（国内生态 API 网关）

**原理**：New-API（基于 one-api 二次开发）是国产开源 LLM API 管理平台，支持根据请求头自动识别 Anthropic / OpenAI / Gemini 格式并翻译。

**接入方式**：
```yaml
# docker-compose.yml
services:
  new-api:
    image: calciumion/new-api:latest
    ports: ["3000:3000"]
    # 在 Web 管理界面配置渠道和模型
```
```
环境变量：
PROVIDER_NEWAPI_BASE_URL=http://new-api-host:3000
PROVIDER_NEWAPI_API_KEY=sk-xxx
```

**代码改动**：零。

| 评估维度 | 分析 |
|----------|------|
| **工具调用** | 支持 Anthropic Chat Messages 格式的 Tool Calling（有官方文档），但翻译质量未经 Claude Agent SDK 深度验证 |
| **流式响应** | 支持 SSE 流式 |
| **稳定性** | **中等**。国内社区活跃，但针对 Claude Agent SDK 场景的测试报告较少 |
| **区域限制** | **最优**。原生支持国内渠道（阿里云百炼、腾讯云等），也可接入海外 API |
| **成本** | 开源免费 |
| **部署复杂度** | **中等**。Docker 部署 + Web 界面配置渠道 |
| **社区生态** | 国内最大。中文文档、中文社区，Linux.do 活跃讨论 |

**风险**：
- 工具调用翻译的深度和准确性未在 Claude Agent SDK 场景下充分验证
- 基于 one-api 的模型映射会重构请求体，部分字段可能丢失

---

### 3.4 Claude Adapter / Claude Bridge（轻量级协议转换器）

**原理**：专为 Claude Code 设计的双向协议转换代理，拦截 Anthropic Messages API 请求，翻译为 OpenAI Chat Completions 格式。

**代表项目**：
- **Claude Adapter** — Docker 部署 / Cloudflare Pages
- **Claude Bridge** (`npx claude-bridge`) — npm 包，本地运行
- **CLASP** — Go 语言实现，Docker 部署

**优势**：
- 轻量级，部署简单（一行 `npx claude-bridge` 或 Docker 启动）
- 无需 VPN（配合老张 API 等国内直连服务）
- 非流式工具调用翻译正确

**实测结果（2026-05-19）**：

| 测试项 | Claude Adapter | Claude Bridge |
|--------|:--------------:|:-------------:|
| 基本对话 | ✅ | ✅ |
| 流式对话 | ✅ | ❌ |
| 工具调用（非流式） | ✅ | ✅ |
| 工具结果回传 | ✅ | ❌ |
| 流式工具调用 | ✅ | ❌ |
| **总评** | **5/5 全通过** | **2/5** |

**⚠️ 关键发现：Claude Adapter 与 Claude Bridge 是不同项目，翻译质量差异很大。**

| 项目 | 安装方式 | 默认端口 | 核心机制 | 测试结果 |
|------|---------|:--------:|---------|:--------:|
| **Claude Adapter** | `npm install -g claude-adapter` | 3080 | Node.js HTTP 翻译代理 | **5/5 ✅** |
| **Claude Bridge** | `npx claude-bridge` | 8000/8080 | 本地代理服务器 | 2/5 ❌ |
| **CLASP** | Go 二进制 / Docker | 不同 | Go 实现的代理 | 未测试 |

**可用性结论**：
- **Claude Adapter 翻译质量可靠**，5 项验证全部通过，流式工具调用和 ID 映射翻译正确
- 配合老张 API 可实现国内直连方案，无需 VPN
- 老张 API 本身没有问题，GPT 模型可正常调用

---

### 3.5 CC Switch / UniClaudeProxy / Castari Proxy

这三个方案定位相似，合并分析。

**原理**：均为社区开发的 Claude Code 专用代理，核心功能是 Anthropic ↔ OpenAI 协议双向翻译。

| 特性 | CC Switch | UniClaudeProxy | Castari Proxy |
|------|-----------|----------------|---------------|
| **定位** | ChatGPT 订阅用户转向 Claude Code | 多 LLM 通用代理 | Claude Agent SDK 专用代理 |
| **工具调用** | 支持 | 剥离原生工具，注入 XML 描述 | 专为 Agent SDK 设计 |
| **流式响应** | 支持 | 支持 | 支持 |
| **Docker 部署** | 支持 | 支持 | 支持 |
| **特色功能** | OAuth 登录、ChatGPT 订阅复用 | XML 工具注入 | 保持 Agent 逻辑完整性 |
| **成熟度** | v3.13，较成熟 | 较新 | 较新 |
| **社区规模** | 中等 | 小 | 小 |

**代码改动**：零。

**共同风险**：
- 均为社区个人项目，长期维护不确定
- 文档较少，排错困难

---

### 3.6 代码层改造（自行实现双协议路由）

**原理**：在容器中同时安装 OpenAI SDK，根据 provider 类型选择不同的脚本模板执行。

**需要修改的文件**：

| 文件 | 修改内容 |
|------|---------|
| `docker/Dockerfile.sandbox` | 添加 `openai` npm 包 |
| 新建 `openaiScriptTemplate.js` | 生成调用 OpenAI SDK 的脚本 |
| `backend/services/container/claude/ClaudeQuery.js` | 根据 provider 路由到不同脚本 |
| `backend/services/container/claude/ScriptBuilder.js` | 支持 provider 判断 |
| `backend/websocket/handlers/chat.js` | 新增 OpenAI command handler |

| 评估维度 | 分析 |
|----------|------|
| **工具调用** | **需自行实现**。OpenAI SDK 不原生支持 Claude Agent SDK 的工具协议，需要自己实现工具注册、调用、结果回传的完整循环 |
| **流式响应** | 需适配 OpenAI SSE 格式到现有 chunk 处理逻辑 |
| **稳定性** | **最高可控**，但开发周期长 |
| **区域限制** | 可控（直连或通过代理） |
| **成本** | 无额外成本 |
| **部署复杂度** | **开发复杂度最高**，估计 2-3 周工作量 |
| **维护成本** | 高。需跟随两个 SDK 版本迭代 |

---

## 四、结构化对比

### 4.1 多维度评分矩阵

**评分标准**：1-5 分，5 分最优。

| 维度 | 权重 | OpenRouter | Claude Adapter ★ | LiteLLM | New-API | CC Switch 等 | 代码改造 |
|------|------|:----------:|:----------------:|:-------:|:-------:|:----------:|:--------:|
| **工具调用兼容性** | 25% | **4** | **5** | 2★ | 3 | 3 | 5 |
| **流式响应可靠性** | 20% | **4** | **5** | 2★ | 3 | 3 | 5 |
| **区域限制可控性** | 15% | **3** | **5** | 4 | 5 | 4 | 5 |
| **部署复杂度** (低=好) | 15% | **4** | **4** | 3 | 3 | 4 | 1 |
| **代码侵入性** (零=好) | 10% | **4** | **5** | 5 | 5 | 5 | 1 |
| **长期维护成本** (低=好) | 10% | 4 | 3 | 3 | 3 | 2 | 1 |
| **社区/生态成熟度** | 5% | 4 | 2 | 5 | 4 | 2 | 5 |
| **加权总分** | 100% | **3.85** | **4.55** | **3.05** | **3.45** | **3.20** | **3.70** |

> ★ Claude Adapter 经实测 5/5 项全通过，含流式工具调用和工具结果回传
> ★ LiteLLM 的流式工具调用存在系统性 Bug，是致命缺陷

### 4.2 关键特性对比

| 特性 | OpenRouter | Claude Adapter ★ | LiteLLM | New-API | Claude Bridge | 代码改造 |
|------|:---------:|:----------------:|:-------:|:-------:|:------------:|:--------:|
| 代码改动量 | 极少（3行env） | 零（自部署） | 零 | 零 | 零 | 大量 |
| 工具调用（非流式） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 工具调用（流式） | ✅ | **✅** | ❌ Bug | ⚠️ 未充分验证 | ❌ | ✅ |
| 工具结果回传 | ✅ | **✅** | ⚠️ | ⚠️ 未充分验证 | ❌ ID映射断裂 | ✅ |
| Thinking blocks | ❌ 非 Claude 模型不支持 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Context management | ❌ 非 Claude 模型不支持 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 会话恢复 (resume) | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ✅ 完整 |
| 多模型切换 | ✅ 200+ | ✅ 手动配置 | ✅ 100+ | ✅ 渠道管理 | ✅ 任意 | ✅ 自定义 |
| 海外 VPS 部署 | 不适用 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 国内直连 | ❌ | ✅ 配合老张API | ❌ | ✅ | ✅ 无需VPN | 按需 |
| Web 管理界面 | ❌ | ❌ | ✅ | ✅ | ❌ | N/A |

备注：
  **Thinking blocks（扩展思考）**

  这是 Anthropic 的专属功能：模型在正式回答前输出一段「思考过程」，类似思维链：

  用户：分析这段代码的性能问题
  模型：
    [thinking] 这段代码有 O(n²) 的嵌套循环...
    [assistant] 我分析了你的代码，发现以下性能问题...

  项目现状：SDK v0.2.59 确实支持这个选项，但代码里从未传过 thinking 参数。

  ScriptBuilder.js        → 不设 thinking  ← 没有
  OptionsMapper.js        → 不设 thinking  ← 没有
  sdkScriptTemplate.js    → 不设 thinking  ← 没有

  **Context management**

  这是 Anthropic 的 beta 功能，用于超长上下文管理（context-1m-2025-08-07）。需要 SDK 传 betas: ['context-1m-2025-08-07'] 启用。

  项目现状：代码里从未传过 betas 参数。

  结论

  | 功能                 | SDK 支持 | 项目使用  | 切换 GPT 后影响 |
  |--------------------|--------|-------|------------|
  | Thinking blocks    | ✅ 支持   | ❌ 未使用 | 无影响        |
  | Context management | ✅ 支持   | ❌ 未使用 | 无影响        |

### 4.3 区域限制应对策略

| 方案 | 区域限制应对 |
|------|------------|
| **OpenRouter** | 宿主机安装 VPN 客户端 + 开启 Allow LAN，容器内注入 HTTP_PROXY。**缺点**：VPN 是单点故障 |
| **LiteLLM** | 部署在海外 VPS，国内项目直连 VPS |
| **New-API** | 部署在海外 VPS；或使用 New-API 接入国内渠道（阿里云百炼等） |
| **Claude Adapter** | 部署在海外 VPS |
| **代码改造** | 在代码中配置代理地址 |

---

## 五、风险与限制（共性）

### 5.1 所有代理方案共有的根本限制

无论选择哪个代理方案，都存在以下**不可回避的架构性限制**：

| 限制 | 原因 | 影响 |
|------|------|------|
| **Extended Thinking 不可用** | GPT 模型不支持 Anthropic 的 thinking blocks | 高级推理场景受限 |
| **Context Management 不可用** | 非 Claude 模型不支持 Anthropic 的上下文管理协议 | 长对话场景可能出现 400 错误 |
| **Session Resume 有限** | Claude Agent SDK 的 session resume 依赖 Anthropic 协议的完整状态 | 切换模型后可能无法恢复会话 |
| **工具质量差异** | GPT 模型的工具调用准确度低于 Claude（尤其在复杂多工具场景） | 用户体验可能不如 Claude 原生 |
| **流式工具调用翻译** | Anthropic 流式 SSE 和 OpenAI 流式 SSE 的工具调用块结构不同，翻译容易丢数据 | 这是所有代理方案的核心技术风险 |

### 5.2 风险等级矩阵

| 风险 | OpenRouter | Claude Adapter ★ | LiteLLM | New-API | Claude Bridge | 代码改造 |
|------|:----------:|:-----------------:|:-------:|:-------:|:------------:|:--------:|
| 流式工具调用失败 | 🟡 中 | **🟢 低**（实测通过） | 🔴 高 | 🟡 中 | 🔴 高 | 🟢 无 |
| 区域访问受限 | 🟡 中 | 🟢 低 | 🟢 低 | 🟢 低 | 🟢 低 | 🟡 中 |
| 第三方服务宕机 | 🔴 高 | 🟡 中 | 🟡 中 | 🟡 中 | 🟡 中 | 🟢 无 |
| 协议翻译精度 | 🟡 中 | **🟢 低**（实测通过） | 🔴 中 | 🟡 中 | 🔴 高 | 🟢 无 |
| 长期维护断裂 | 🟡 中 | 🟡 中 | 🟢 低 | 🟡 中 | 🔴 高 | 🟢 无 |
| 模型工具质量 | 🟡 中 | 🟡 中 | 🔴 高 | 🟡 中 | 🟡 中 | 🟢 无 |

---

## 六、推荐方案

### 6.1 分场景推荐

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| **快速验证（PoC）** | **Claude Adapter + 老张 API** | 经实测 5/5 全通过，无需 VPN，国内直连 |
| **生产环境（国内部署，无 VPN）** | **Claude Adapter + 老张 API ★** | **评分 4.55 最高**，国内直连无区域限制，全功能通过 |
| **生产环境（国内部署，有 VPN）** | **OpenRouter** | 无需部署额外服务，配置最简 |
| **生产环境（海外部署）** | **Claude Adapter + OpenAI 直连** | 无区域限制，可直连 OpenAI |
| **长期自主可控** | **代码层改造** | 完全可控，但投入最大 |

### 6.2 推荐实施路径

```
方案 A（推荐）：Claude Adapter + 老张 API（国内部署，无需 VPN）
  1. 宿主机安装 Claude Adapter: npm install -g claude-adapter
  2. 启动并配置目标 API 为老张 API: claude-adapter
     - Base URL: https://api.laozhang.ai/v1
     - API Key: 老张 API 密钥
     - 模型映射: Opus→gpt-5.5, Sonnet→gpt-4o, Haiku→gpt-4.1-nano
     - 工具类型: Native (OpenAI Format)
  3. 将 Claude Adapter 部署为系统服务（systemd / PM2）长期运行
  4. .env.deploy 配置新 provider，指向 Claude Adapter 地址
  5. 添加 GPT 模型到 AVAILABLE_MODELS

  运维注意：Claude Adapter 是单点，建议 PM2 守护进程

方案 B：OpenRouter + 宿主机 VPN
  1. 宿主机安装 VPN 客户端（如 Clash Verge），开启 Allow LAN
  2. 修改 DockerExecutor.js 注入 HTTP_PROXY 环境变量
  3. .env.deploy 添加 OpenRouter provider + GPT 模型
  4. 重启服务

  运维注意：VPN 掉线 → GPT 模型不可用；监控容器网络连通性

方案 C：New-API + 海外 VPS
  1. 购买海外 VPS
  2. 部署 New-API
  3. .env.deploy 配置新 provider
  4. 添加 GPT 模型到 AVAILABLE_MODELS

共性注意事项：
  - GPT 模型在复杂工具链中参数准确性不如 Claude，复杂任务建议仍用 Claude
  - 流式 + 工具调用的协议翻译是所有代理方案的核心技术风险
```

---

## 七、附录

### A. 候选方案资源链接

| 方案 | 仓库/官网 | 语言 |
|------|----------|------|
| OpenRouter | https://openrouter.ai | SaaS |
| LiteLLM | https://github.com/BerriAI/litellm | Python |
| New-API | https://github.com/songquanpeng/one-api (原版) / https://www.newapi.ai | Go |
| Claude Adapter | https://github.com/shantoislamdev/claude-adapter | JS |
| CC Switch | https://github.com/farion1231/cc-switch | - |
| UniClaudeProxy | https://github.com/vibheksoni/UniClaudeProxy | JS |
| Castari Proxy | https://github.com/castari/castari-proxy | - |

### B. LiteLLM 已知 Bug 列表

| Issue | 描述 | 状态 |
|-------|------|------|
| #12158 | `/v1/messages` SDK 流式工具调用不工作（非 Anthropic 模型） | Open |
| #25321 | 流式适配器丢弃 `tool_use` 输入参数 | Open |
| #25561 | 流式端点丢弃 `tool_use` 参数（系统性 Bug） | 有 PR |
| #25836 | Gemini 模型流式工具调用参数丢失 | Open |
| #25605 | Ollama provider 流式模式工具参数丢失 | Open |
| #17904 | 工具名称翻译不正确 | Open |

### C. 术语表

| 术语 | 含义 |
|------|------|
| Anthropic Messages API | Anthropic 的 LLM 调用协议，端点 `/v1/messages` |
| OpenAI Chat Completions | OpenAI 的 LLM 调用协议，端点 `/v1/chat/completions` |
| Anthropic Skin | OpenRouter 提供的 Anthropic 格式兼容层 |
| tool_use | Anthropic 协议中的工具调用块格式 |
| tool_calls | OpenAI 协议中的工具调用块格式 |
| SSE | Server-Sent Events，流式响应传输协议 |
| BYOK | Bring Your Own Key，自带 API 密钥 |
