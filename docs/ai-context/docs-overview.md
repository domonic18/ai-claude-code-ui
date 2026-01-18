# 文档架构

此项目使用**三层文档系统**，按稳定性和范围组织知识，实现高效的 AI 上下文加载和可扩展开发。

## 三层系统工作原理

**第1层（基础）**：稳定的、系统范围的文档，很少变更 - 架构原则、技术决策、跨组件模式和核心开发协议。

**第2层（组件）**：主要组件的架构章程 - 高层设计原则、集成模式和组件范围约定，不包含功能特定细节。

**第3层（功能特定）**：与代码共同定位的详细文档 - 具体实现模式、技术细节和随功能演进的局部架构决策。

此层次结构允许 AI 智能体高效加载目标上下文，同时维护稳定的核心知识基础。

## 文档原则
- **共同定位**：文档与相关代码放在一起
- **智能扩展**：在必要时自动创建新文档文件
- **AI 优先**：为高效 AI 上下文加载和机器可读模式优化

## 第1层：基础文档（系统范围）

- **[主上下文](/CLAUDE.md)** - *每个会话必需。* 编码标准、安全要求、MCP 服务器集成模式和开发协议
- **[项目结构](/docs/ai-context/project-structure.md)** - *必读。* 完整技术栈、文件树和系统架构。必须附加到 Gemini 咨询
- **[系统集成](/docs/ai-context/system-integration.md)** - *跨组件工作用。* 通信模式、数据流、测试策略和性能优化
- **[部署基础设施](/docs/ai-context/deployment-infrastructure.md)** - *基础设施模式。* 容器化、监控、CI/CD 工作流和扩展策略
- **[任务管理](/docs/ai-context/handoff.md)** - *会话连续性。* 当前任务、文档系统进度和下次会话目标

## 第2层：组件级文档

### 后端组件
- **[后端上下文](/backend/CONTEXT.md)** - *服务器实现。* API 模式、数据库集成、服务架构和性能考虑
- **[共享库](/shared/CONTEXT.md)** - *可重用代码。* 通用工具、共享类型和跨组件功能

### 前端组件
- **[Web 应用](/frontend/CONTEXT.md)** - *客户端实现。* UI 模式、状态管理、路由和用户交互模式

### 功能模块组件
- **[Chat 功能](/frontend/features/chat/CONTEXT.md)** - *聊天功能。* 消息处理、流式响应和聊天交互
- **[Settings 功能](/frontend/features/settings/CONTEXT.md)** - *设置功能。* 用户配置、MCP 服务器设置和偏好管理
- **[Sidebar 功能](/frontend/features/sidebar/CONTEXT.md)** - *侧边栏功能。* 项目管理、会话历史和导航

## 第3层：功能特定文档

与代码共同定位的详细 CONTEXT.md 文件，最小级联效应：

### 后端功能文档
- **[核心服务](/backend/services/core/CONTEXT.md)** - *业务逻辑模式。* 服务架构、数据处理、集成模式和错误处理
- **[API 层](/backend/routes/CONTEXT.md)** - *API 模式。* 端点设计、验证、中间件和请求/响应处理
- **[数据库集成](/backend/database/CONTEXT.md)** - *数据模式。* ORM 模式、查询优化、迁移策略和数据建模
- **[容器服务](/backend/services/container/CONTEXT.md)** - *容器管理。* Docker 容器生命周期、资源限制和隔离策略
- **[会话服务](/backend/services/sessions/CONTEXT.md)** - *会话管理。* 用户会话、状态管理和会话持久化

### 前端功能文档
- **[共享组件](/frontend/shared/components/CONTEXT.md)** - *UI 模式。* 组件架构、样式管理、可访问性和用户体验模式
- **[共享上下文](/frontend/shared/contexts/CONTEXT.md)** - *应用状态。* 状态架构、数据流、缓存策略和状态同步
- **[路由配置](/frontend/router/CONTEXT.md)** - *导航模式。* 路由配置、守卫、懒加载和导航流程

## 使用指南

### 对于 AI 智能体

**简单任务**：仅加载第1层文档
```
- CLAUDE.md（编码标准）
- project-structure.md（项目概述）
```

**组件工作**：加载第1层 + 相关第2层
```
- 基础文档 + 特定组件 CONTEXT.md
```

**复杂实现**：加载所有相关层
```
- 基础 + 组件 + 功能特定文档
```

### 对于开发者

**添加新功能**：
1. 检查现有第3层文档是否适用
2. 必要时创建新的 CONTEXT.md
3. 更新相关第2层文档（如有架构变更）
4. 第1层文档保持不变

**新组件**：
1. 创建组件级 CONTEXT.md（第2层）
2. 为主要功能创建第3层文档
3. 更新 docs-overview.md 添加导航

## 文档模板

使用标准化模板确保一致性：

- **[第1层模板](templates/CLAUDE.md)** - 主项目上下文
- **[第2层模板](templates/CONTEXT-tier2-component.md)** - 组件架构
- **[第3层模板](templates/CONTEXT-tier3-feature.md)** - 功能实现

## 文档维护

### 自动化
- 文档与代码变更同步检查
- 过期文档检测和警告
- 模板一致性验证

### 手动审核
- 季度文档架构审核
- 新团队成员文档可用性测试
- AI 上下文加载效率分析

---

*此文档架构是 Claude Code 开发套件的核心。它确保 AI 智能体始终具备适当上下文，同时保持文档的可维护性和相关性。*