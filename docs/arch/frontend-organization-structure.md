# 前端代码组织结构

**文档版本：** 1.1
**创建日期：** 2026-01-14
**更新日期：** 2026-01-18
**状态：** 已实施

---

## 目录

1. [设计原则](#1-设计原则)
2. [完整目录结构](#2-完整目录结构)
3. [目录职责详解](#3-目录职责详解)
4. [文件命名规范](#4-文件命名规范)
5. [模块化原则](#5-模块化原则)
6. [依赖关系图](#6-依赖关系图)
7. [迁移策略](#7-迁移策略)
8. [最佳实践](#8-最佳实践)

---

## 1. 设计原则

### 1.1 核心原则

**SOLID 原则：**
- **单一职责**：每个文件/模块只负责一个功能
- **开闭原则**：对扩展开放，对修改封闭
- **里氏替换**：子组件可替换父组件
- **接口隔离**：细粒度的接口和模块
- **依赖倒置**：依赖抽象而非具体实现

**React 最佳实践：**
- 组件小于 350 行
- 关注点分离（UI/逻辑/数据）
- 组合优于继承
- 自上而下的数据流

**项目特定原则：**
1. **按功能组织**（Feature-based）：而非按类型组织
2. **明确的层次**：清晰的依赖方向
3. **可测试性**：每个模块都可独立测试
4. **可维护性**：新开发者能快速定位代码

### 1.2 架构分层

```
┌─────────────────────────────────────────┐
│         视图层 (View Layer)              │
│  - 页面组件 (Pages)                      │
│  - 功能组件 (Features)                   │
│  - UI 组件 (Components)                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       业务逻辑层 (Business Logic)        │
│  - 自定义 Hooks (Hooks)                  │
│  - 状态管理 (Store/Context)              │
│  - 表单处理 (Forms)                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        数据层 (Data Layer)               │
│  - API 服务 (Services)                   │
│  - 数据模型 (Types/Models)               │
│  - 数据验证 (Validators)                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       基础设施层 (Infrastructure)        │
│  - 工具函数 (Utils)                      │
│  - 常量定义 (Constants)                  │
│  - 配置文件 (Config)                     │
└─────────────────────────────────────────┘
```

---

## 2. 完整目录结构

### 2.1 推荐结构

```
frontend/
├── public/                          # 静态资源
│   ├── favicon.ico
│   └── index.html
│
├── main.jsx                         # 应用入口
├── App.jsx                          # 根组件（路由配置）
├── index.css                        # 全局样式
│
├── pages/                           # 页面级组件（路由）
│   ├── Chat/
│   │   ├── ChatPage.jsx             # 聊天页面主组件
│   │   └── index.js
│   ├── Settings/
│   │   ├── SettingsPage.jsx         # 设置页面主组件
│   │   └── index.js
│   └── Onboarding/
│       ├── OnboardingPage.jsx       # 引导页面
│       └── index.js
│
├── features/                        # 功能模块（按业务功能组织）
│   │
│   ├── chat/                        # 聊天功能模块
│   │   │   ├── components/          # 聊天相关组件
│   │   │   │   ├── ChatInterface.tsx        # 主容器
│   │   │   │   ├── ChatMessageList.tsx      # 消息列表
│   │   │   │   ├── ChatInput.tsx            # 输入框
│   │   │   │   ├── ChatMessage.tsx          # 单条消息
│   │   │   │   ├── MessageAttachments.tsx   # 消息附件
│   │   │   │   ├── StreamingIndicator.tsx   # 流式指示器
│   │   │   │   └── index.ts
│   │   │   ├── hooks/               # 聊天相关 hooks
│   │   │   │   ├── useChatMessages.ts
│   │   │   │   ├── useChatScroll.ts
│   │   │   │   ├── useMessageStream.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/            # 聊天业务逻辑
│   │   │   │   ├── chatService.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/               # 类型定义
│   │   │   │   ├── chat.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/               # 聊天工具函数
│   │   │   │   ├── markdownParser.ts
│   │   │   │   ├── codeHighlighter.ts
│   │   │   │   └── index.ts
│   │   │   └── constants/           # 聊天常量
│   │   │       ├── chat.constants.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── settings/                # 设置功能模块
│   │   │   ├── components/          # Settings 组件
│   │   │   │   ├── Settings.tsx             # 主容器（模态框）
│   │   │   │   ├── AgentTab.tsx             # Agent 标签页
│   │   │   │   ├── ApiTab.tsx               # API Keys 标签页
│   │   │   │   ├── AppearanceTab.tsx        # 外观设置标签页
│   │   │   │   ├── TasksTab.tsx             # 任务设置标签页
│   │   │   │   ├── agent/                   # Agent 设置子组件
│   │   │   │   │   ├── AgentSelector.tsx    # Agent 选择器
│   │   │   │   │   ├── AgentPermissions.tsx # 权限设置
│   │   │   │   │   ├── AgentListItem.tsx    # Agent 列表项
│   │   │   │   │   └── McpServerForm.tsx    # MCP 服务器表单
│   │   │   │   ├── common/                  # 通用组件
│   │   │   │   │   ├── CategoryTabs.tsx     # 分类标签
│   │   │   │   │   ├── OpenCodePlaceholder.tsx
│   │   │   │   │   ├── ScopeSelector.tsx    # 作用域选择器
│   │   │   │   │   └── TransportSelector.tsx # 传输方式选择器
│   │   │   │   ├── mcp/                     # MCP 组件
│   │   │   │   │   ├── McpServerList.tsx    # MCP 服务器列表
│   │   │   │   │   └── McpServerCard.tsx    # MCP 服务器卡片
│   │   │   │   └── index.ts
│   │   │   ├── hooks/               # Settings Hooks
│   │   │   │   ├── useSettings.ts           # 通用设置 Hook
│   │   │   │   ├── useAgentSettings.ts      # Agent 设置 Hook
│   │   │   │   ├── useCodeEditorSettings.ts # 代码编辑器设置 Hook
│   │   │   │   ├── useMcpServers.ts         # MCP 服务器 Hook
│   │   │   │   └── index.ts
│   │   │   ├── services/            # Settings 服务层
│   │   │   │   ├── settingsService.ts       # 设置 API 服务
│   │   │   │   └── index.ts
│   │   │   ├── types/               # Settings 类型定义
│   │   │   │   ├── settings.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── validators/          # Settings 验证器
│   │   │   │   ├── settingsValidators.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/               # Settings 工具函数
│   │   │   │   ├── formatters.ts
│   │   │   │   ├── validators.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/           # Settings 常量
│   │   │   │   ├── settings.constants.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts             # 模块导出索引
│   │   │
│   │   ├── project/                 # 项目功能模块
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── SessionHistory.tsx
│   │   │   │   ├── ProjectSearch.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useProjects.ts
│   │   │   │   ├── useSessions.ts
│   │   │   │   ├── useProjectSearch.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── projectFilter.ts
│   │   │   │   └── index.ts
│   │   │   └── constants/
│   │   │       └── index.ts
│   │   │
│   │   │
│   │   ├── tasks/                   # 任务功能模块
│   │   │   ├── components/
│   │   │   │   ├── TaskList.tsx
│   │   │   │   ├── TaskItem.tsx
│   │   │   │   ├── TaskFilters.tsx
│   │   │   │   ├── TaskCreator.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useTasks.ts
│   │   │   │   ├── useTaskFilters.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── constants/
│   │   │       └── index.ts
│   │   │
│   │   ├── file-explorer/           # 文件浏览器模块
│   │   │   ├── components/
│   │   │   │   ├── FileExplorer.tsx
│   │   │   │   ├── FileTree.tsx
│   │   │   │   ├── FileNode.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   └── index.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   │
│   │   ├── editor/                  # 编辑器模块
│   │   │   ├── components/
│   │   │   │   ├── CodeEditor.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   └── index.ts
│   │   │   └── constants/
│   │   │       └── index.ts
│   │   │
│   │   └── terminal/                # 终端模块
│   │       ├── components/
│   │       │   ├── Terminal.tsx
│   │       │   └── index.ts
│   │       ├── hooks/
│   │       │   └── index.ts
│   │       └── constants/
│   │           └── index.ts
│   │
├── shared/                          # 共享模块（跨功能使用）
│   │
│   ├── components/                  # 共享 UI 组件
│   │   ├── ui/                     # 基础 UI 组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/                 # 布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Container.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── common/                 # 通用组件
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── index.ts
│   │
│   ├── hooks/                       # 共享自定义 hooks
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   ├── useThrottle.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useAsync.ts
│   │   ├── useOnClickOutside.ts
│   │   └── index.ts
│   │
│   ├── contexts/                    # React Context 提供者
│   │   ├── AuthContext.tsx
│   │   ├── WebSocketContext.tsx
│   │   ├── ThemeContext.tsx
│   │   ├── TaskMasterContext.tsx
│   │   ├── TasksSettingsContext.tsx
│   │   └── index.ts
│   │
│   ├── services/                    # 共享服务层
│   │   ├── api/
│   │   │   ├── apiClient.ts        # API 客户端基础配置
│   │   │   ├── authenticatedApi.ts # 认证 API 包装器
│   │   │   ├── apiRoutes.ts        # API 路由定义
│   │   │   └── index.ts
│   │   ├── websocket/
│   │   │   ├── websocketClient.ts
│   │   │   ├── websocketTypes.ts
│   │   │   └── index.ts
│   │   └── storage/
│   │       ├── storageService.ts
│   │       ├── localStorage.ts
│   │       ├── sessionStorage.ts
│   │       └── index.ts
│   │
│   ├── types/                       # 共享类型定义
│   │   ├── api.types.ts            # API 相关类型
│   │   ├── common.types.ts         # 通用类型
│   │   ├── user.types.ts           # 用户类型
│   │   ├── websocket.types.ts      # WebSocket 类型
│   │   └── index.ts
│   │
│   ├── utils/                       # 共享工具函数
│   │   ├── format/
│   │   │   ├── formatDate.ts       # 日期格式化
│   │   │   ├── formatNumber.ts     # 数字格式化
│   │   │   └── index.ts
│   │   ├── validation/
│   │   │   ├── validateEmail.ts
│   │   │   ├── validateUrl.ts
│   │   │   └── index.ts
│   │   ├── dom/
│   │   │   ├── scroll.ts
│   │   │   ├── focus.ts
│   │   │   └── index.ts
│   │   ├── file/
│   │   │   ├── fileValidation.ts
│   │   │   ├── fileDownload.ts
│   │   │   └── index.ts
│   │   ├── string/
│   │   │   ├── truncate.ts
│   │   │   ├── slugify.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── constants/                   # 共享常量
│   │   ├── app.constants.ts        # 应用常量
│   │   ├── api.constants.ts        # API 常量
│   │   ├── validation.constants.ts # 验证常量
│   │   ├── ui.constants.ts         # UI 常量
│   │   └── index.ts
│   │
│   └── validators/                  # 共享验证器（Zod schemas）
│       ├── commonValidators.ts
│       ├── apiValidators.ts
│       └── index.ts
│
├── router/                          # 路由配置
│   ├── AppRouter.jsx               # 路由组件
│   ├── ProtectedRoute.jsx          # 受保护路由包装器
│   └── index.js
│
├── config/                          # 配置文件
│   ├── app.config.js               # 应用配置
│   ├── env.config.js               # 环境变量配置
│   ├── routes.config.js            # 路由配置
│   └── index.js
│
├── lib/                             # 第三方库封装
│
├── __tests__/                       # 测试文件
│   ├── __mocks__/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env                             # 环境变量
├── .env.example                     # 环境变量示例
├── .eslintrc.cjs                    # ESLint 配置
├── .prettierrc                      # Prettier 配置
├── tsconfig.json                    # TypeScript 配置
├── vite.config.ts                   # Vite 配置
├── package.json
└── README.md
```

### 2.2 结构对比

**原始结构 vs 当前实施结构：**

| 方面 | 原始结构 | 当前结构 | 改进 |
|------|----------|----------|------|
| 组织方式 | 按类型（components/） | 按功能（features/） | 更好的内聚性 |
| 层次划分 | 不清晰 | 四层架构 | 明确的依赖方向 |
| 代码复用 | 部分复用 | shared/ 集中管理 | 提高复用率 |
| 关注点分离 | 混乱 | 清晰分离 | 易于维护 |
| 可测试性 | 困难 | 模块化设计 | 易于测试 |

---

## 3. 目录职责详解

### 3.1 pages/ - 页面组件

**职责：**
- 路由级别的组件
- 组合多个功能模块
- 处理路由参数和导航
- 不包含业务逻辑

**示例：**
```typescript
// pages/Chat/ChatPage.tsx
import { ChatInterface } from '@/features/chat/components';
import { Sidebar } from '@/features/project/components';
import { Header } from '@/shared/components/layout';

export function ChatPage() {
  return (
    <div className="flex h-screen">
      <Header />
      <Sidebar />
      <ChatInterface />
    </div>
  );
}
```

### 3.2 features/ - 功能模块

**职责：**
- 按业务功能组织的完整模块
- 包含该功能的所有代码（组件、逻辑、类型）
- 独立、可复用、可测试

**每个功能模块包含：**
- `components/` - 功能相关组件
- `hooks/` - 功能相关 hooks
- `services/` - 业务逻辑服务
- `types/` - 类型定义
- `utils/` - 工具函数
- `constants/` - 常量定义
- `validators/` - 验证器（如需要）
- `index.ts` - 导出入口

**优势：**
1. **高内聚**：相关代码集中管理
2. **易维护**：修改功能只需关注一个目录
3. **可测试**：独立的功能模块易于测试
4. **可复用**：功能模块可在项目间复用

### 3.3 shared/ - 共享模块

**职责：**
- 跨功能复用的代码
- 基础设施代码
- 通用工具和组件

**子目录说明：**

#### shared/components/
- `ui/` - 基础 UI 组件（按钮、输入框等）
- `layout/` - 布局组件（头部、侧边栏等）
- `common/` - 通用组件（加载器、错误边界等）

#### shared/hooks/
- 全局共享的自定义 hooks
- 不特定于某个业务功能

#### shared/services/
- `api/` - API 客户端和路由
- `websocket/` - WebSocket 客户端
- `storage/` - 存储服务

#### shared/types/
- 跨功能使用的类型定义
- API 响应类型
- 通用类型

#### shared/utils/
- 按功能分类的工具函数
- 每个类别有自己的 index.ts

#### shared/constants/
- 应用级常量
- API 常量
- UI 常量

#### shared/validators/
- Zod 验证 schemas
- 运行时类型验证

### 3.4 config/ - 配置文件

**职责：**
- 集中管理应用配置
- 环境变量处理
- 路由配置

### 3.5 router/ - 路由配置

**职责：**
- 定义应用路由结构
- 路由守卫和权限控制
- 路由级别的布局

### 3.6 styles/ - 样式文件

**职责：**
- 全局样式
- CSS 变量和主题
- Tailwind 基础配置

### 3.7 __tests__/ - 测试文件

**职责：**
- 镜像项目结构的测试文件
- 单元测试、集成测试、E2E 测试
- 测试 mocks

---

## 4. 文件命名规范

### 4.1 基本规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 组件文件 | PascalCase | `ChatInterface.tsx` |
| Hook 文件 | camelCase, `use` 前缀 | `useChatMessages.ts` |
| 工具文件 | camelCase | `formatDate.ts` |
| 类型文件 | camelCase, `.types` 后缀 | `chat.types.ts` |
| 常量文件 | camelCase, `.constants` 后缀 | `api.constants.ts` |
| 服务文件 | camelCase, `.service` 后缀 | `chatService.ts` |
| 配置文件 | camelCase, `.config` 后缀 | `app.config.ts` |
| 测试文件 | camelCase, `.test` 或 `.spec` 后缀 | `useChat.test.ts` |

### 4.2 组件命名

**组件文件名 = 组件名**
```typescript
// ✅ 正确
// components/ChatInterface.tsx
export function ChatInterface() { ... }

// ❌ 错误
// components/ChatInterface.tsx
export function Chat() { ... }
```

**索引文件导出：**
```typescript
// components/index.ts
export { ChatInterface } from './ChatInterface';
export { ChatInput } from './ChatInput';
export { ChatMessageList } from './ChatMessageList';
```

### 4.3 Hook 命名

**必须以 `use` 开头：**
```typescript
// ✅ 正确
export function useChatMessages() { ... }
export function useWebSocket() { ... }

// ❌ 错误
export function getChatMessages() { ... }
export function chatMessages() { ... }
```

### 4.4 类型文件命名

**使用 `.types.ts` 后缀：**
```typescript
// chat.types.ts
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}
```

### 4.5 服务文件命名

**使用 `.service.ts` 后缀：**
```typescript
// chatService.ts
export class ChatService {
  async sendMessage(content: string): Promise<void> { ... }
  async getHistory(): Promise<ChatMessage[]> { ... }
}
```

---

## 5. 模块化原则

### 5.1 模块边界

**明确的模块边界：**
```
features/chat/        # 聊天模块
  └── 不应直接引用 features/settings/
shared/              # 共享模块
  └── 任何模块都可以引用
```

**依赖规则：**
1. 功能模块之间不直接依赖
2. 功能模块可以依赖共享模块
3. 共享模块之间可以相互依赖
4. 页面组件可以组合多个功能模块

### 5.2 导入规范

**使用路径别名：**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./"],
      "@/features/*": ["./features/*"],
      "@/shared/*": ["./shared/*"],
      "@/components/*": ["./shared/components/*"],
      "@/hooks/*": ["./shared/hooks/*"],
      "@/utils/*": ["./shared/utils/*"],
      "@/types/*": ["./shared/types/*"],
      "@/services/*": ["./shared/services/*"]
    }
  }
}
```

**导入示例：**
```typescript
// ✅ 推荐 - 使用路径别名
import { Button } from '@/shared/components/ui/Button';
import { useChatMessages } from '@/features/chat/hooks';
import { formatMessage } from '@/features/chat/utils';

// ❌ 避免 - 相对路径
import { Button } from '../../../../shared/components/ui/Button';
import { useChatMessages } from '../../hooks/useChatMessages';
```

### 5.3 索引文件模式

**每个模块导出索引：**
```typescript
// features/chat/components/index.ts
export { ChatInterface } from './ChatInterface';
export { ChatInput } from './ChatInput';
export { ChatMessageList } from './ChatMessageList';
export { ChatMessage } from './ChatMessage';

// 使用时
import { ChatInterface, ChatInput } from '@/features/chat/components';
```

### 5.4 循环依赖检测

**避免循环依赖：**
```typescript
// ❌ 循环依赖
// features/chat/hooks/useChatMessages.ts
import { useSettings } from '@/features/settings/hooks';

// features/settings/hooks/useSettings.ts
import { useChatMessages } from '@/features/chat/hooks';

// ✅ 解决方案 - 提取到 shared
// shared/hooks/useChatAndSettings.ts
import { useChatMessages } from '@/features/chat/hooks';
import { useSettings } from '@/features/settings/hooks';
```

---

## 6. 依赖关系图

### 6.1 模块依赖

```
                    ┌─────────────┐
                    │    pages/   │  页面层
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  chat/   │    │ project/ │    │ settings/│  功能层
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         └───────────────┼───────────────┘
                         ↓
                  ┌──────────────┐
                  │    shared/   │  共享层
                  └──────┬───────┘
                         │
                  ┌──────────────┐
                  │   config/    │  配置层
                  └──────────────┘
```

### 6.2 数据流

```
┌─────────────────────────────────────────┐
│              用户交互                    │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│         UI 组件 (features/...)           │
│  - 处理用户输入                          │
│  - 触发 actions                          │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│     自定义 Hooks (features/.../hooks)    │
│  - 封装业务逻辑                          │
│  - 管理组件状态                          │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│      服务层 (shared/services)            │
│  - API 调用                              │
│  - WebSocket 通信                        │
│  - 数据转换                              │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│          后端 API / WebSocket            │
└─────────────────────────────────────────┘
```

### 6.3 组件层次

```
App.tsx (根组件)
  ├── AppRouter.tsx (路由)
  │     ├── ProtectedRoute.tsx (路由守卫)
  │     │     ├── ErrorBoundary (错误边界)
  │     │     │     └── 页面组件 (pages/)
  │     │     │           └── 功能组件 (features/)
  │     │     │                 └── 共享组件 (shared/components/)
  │     │     │                       └── 基础组件 (shared/components/ui/)
```

---

## 7. 迁移策略

> **注意：** 此架构已完成实施，以下为原始迁移计划记录。

### 7.1 迁移优先级（已完成）

**阶段 1：基础架构（已完成）**
1. ✅ 创建新目录结构
2. ✅ 设置路径别名
3. ✅ 配置 TypeScript
4. ✅ 迁移共享模块

**阶段 2：核心功能（已完成）**
1. ✅ 迁移 chat 模块
2. ✅ 迁移 settings 模块
3. ✅ 迁移 sidebar 模块

**阶段 3：扩展功能（已完成）**
1. ✅ 迁移 editor 模块
2. ✅ 迁移 file-explorer 模块
3. ✅ 迁移 terminal 模块
4. ✅ 迁移 system 模块
5. ✅ 迁移 auth 模块

### 7.2 迁移步骤

**单个模块迁移流程：**

```
1. 分析当前组件
   └─ 识别依赖关系
   └─ 规划新结构

2. 创建新目录
   └─ features/ModuleName/
   └─ 创建子目录 (components, hooks, services, etc.)

3. 提取代码
   └─ 组件 → components/
   └─ 逻辑 → hooks/
   └─ 工具 → utils/
   └─ 类型 → types/

4. 更新导入
   └─ 添加路径别名
   └─ 更新相对路径

5. 测试验证
   └─ 功能测试
   └─ 回归测试

6. 清理旧代码
   └─ 删除原文件
   └─ 更新文档
```

### 7.3 迁移示例

**ChatInterface.jsx 迁移：**

**原始结构：**
```
components/
└── ChatInterface.jsx  (5,106 行)
```

**迁移后结构：**
```
features/chat/
├── components/
│   ├── ChatInterface.tsx      (150 行) - 主容器
│   ├── ChatMessageList.tsx    (200 行) - 消息列表
│   ├── ChatInput.tsx          (200 行) - 输入框
│   ├── ChatMessage.tsx        (150 行) - 单条消息
│   └── MarkdownRenderer.tsx   (250 行) - Markdown 渲染
├── hooks/
│   ├── useChatMessages.ts     (100 行) - 消息状态
│   ├── useChatScroll.ts       (80 行) - 滚动逻辑
│   └── useMessageStream.ts    (100 行) - 流式状态
├── services/
│   └── chatService.ts         (150 行) - 业务逻辑
├── utils/
│   ├── markdownParser.ts      (100 行) - 解析工具
│   └── codeHighlighter.ts     (80 行) - 高亮工具
├── types/
│   └── chat.types.ts          (50 行) - 类型定义
└── constants/
    └── chat.constants.ts      (30 行) - 常量
```

### 7.4 迁移检查清单

**迁移前：**
- [ ] 备份当前代码
- [ ] 创建新分支
- [ ] 更新路径别名配置

**迁移中：**
- [ ] 按优先级选择模块
- [ ] 创建新目录结构
- [ ] 分离关注点
- [ ] 更新所有导入
- [ ] 添加类型定义
- [ ] 编写测试

**迁移后：**
- [ ] 功能测试
- [ ] 性能测试
- [ ] 代码审查
- [ ] 更新文档
- [ ] 合并分支

---

## 8. 最佳实践

### 8.1 组件设计

**单一职责：**
```typescript
// ✅ 组件只负责渲染
export function ChatMessage({ message }: { message: ChatMessage }) {
  return <div className="message">{message.content}</div>;
}

// ❌ 组件包含业务逻辑
export function ChatMessage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    fetchMessage(messageId).then(setMessage);
  }, [messageId]);
  return <div className="message">{message?.content}</div>;
}
```

**组合优于继承：**
```typescript
// ✅ 使用组合
export function ChatInterface() {
  return (
    <>
      <ChatMessageList />
      <ChatInput />
    </>
  );
}

// ❌ 避免继承
class ChatInterface extends BaseChatComponent { }
```

### 8.2 Hook 设计

**关注点分离：**
```typescript
// ✅ Hook 封装特定逻辑
export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);
  return { messages, addMessage };
}

// ❌ Hook 混合多个关注点
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [settings, setSettings] = useState({});
  const [user, setUser] = useState(null);
  // ... 多个不相关的状态
}
```

**依赖数组：**
```typescript
// ✅ 正确的依赖
useEffect(() => {
  fetchMessages();
}, [sessionId]); // 明确依赖

// ❌ 遗漏依赖
useEffect(() => {
  fetchMessages();
}, []); // 缺少 sessionId
```

### 8.3 类型定义

**集中管理：**
```typescript
// ✅ 类型集中定义
// features/chat/types/chat.types.ts
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
}

// ❌ 类型分散定义
// ChatMessage.tsx
interface ChatMessage { ... }

// ChatInput.tsx
interface ChatMessage { ... }
```

**类型导出：**
```typescript
// features/chat/types/index.ts
export * from './chat.types';
export * from './stream.types';

// 使用
import type { ChatMessage, StreamState } from '@/features/chat/types';
```

### 8.4 错误处理

**统一错误处理：**
```typescript
// shared/utils/error/errorHandler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown, context: string) {
  if (error instanceof AppError) {
    console.error(`[${context}]`, error.message, error.context);
  } else {
    console.error(`[${context}]`, error);
  }
  // 发送到错误跟踪服务
}
```

### 8.5 性能优化

**代码分割：**
```typescript
// router/AppRouter.tsx
import { lazy, Suspense } from 'react';

const ChatPage = lazy(() => import('@/pages/Chat/ChatPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/:sessionId?" element={<ChatPage />} />
        <Route path="/settings/:tab?" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  );
}
```

**组件优化：**
```typescript
import { memo, useCallback, useMemo } from 'react';

// 使用 memo 避免不必要的重渲染
export const ChatMessage = memo(function ChatMessage(
  { message }: { message: ChatMessage }
) {
  // 使用 useMemo 缓存计算结果
  const formattedTime = useMemo(
    () => formatTimestamp(message.timestamp),
    [message.timestamp]
  );

  // 使用 useCallback 稳定函数引用
  const handleClick = useCallback(() => {
    onSelectMessage(message.id);
  }, [message.id, onSelectMessage]);

  return (
    <div onClick={handleClick}>
      {message.content} - {formattedTime}
    </div>
  );
});
```

### 8.6 代码规范

**ESLint 配置：**
```javascript
// .eslintrc.cjs
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
};
```

**Prettier 配置：**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 8.7 文档规范

**JSDoc 注释：**
```typescript
/**
 * 聊天消息 Hook
 *
 * 提供聊天消息的状态管理和操作方法
 *
 * @example
 * ```tsx
 * const { messages, addMessage, removeMessage } = useChatMessages();
 * ```
 *
 * @returns 聊天消息状态和操作方法
 */
export function useChatMessages() {
  // ...
}

/**
 * 发送聊天消息
 *
 * @param message - 消息内容
 * @param options - 发送选项
 * @param options.files - 附件文件数组
 * @throws {AppError} 当消息为空时抛出错误
 * @returns Promise<void>
 */
export async function sendMessage(
  message: string,
  options?: { files?: File[] }
): Promise<void> {
  // ...
}
```

---

## 9. 总结

### 9.1 核心改进（已完成）

| 方面 | 改进 | 状态 |
|------|------|------|
| **组织方式** | 从按类型组织改为按功能组织 | ✅ 完成 |
| **代码复用** | 集中的 shared/ 模块 | ✅ 完成 |
| **关注点分离** | 清晰的四层架构 | ✅ 完成 |
| **可维护性** | 模块化、小型化的组件 | ✅ 完成 |
| **可测试性** | 独立的功能模块 | ✅ 完成 |
| **类型安全** | TypeScript + 集中的类型定义 | ✅ 完成 |

### 9.2 预期收益

- **开发效率提升 30%**：清晰的代码组织
- **维护成本降低 40%**：模块化设计
- **Bug 减少 50%**：类型安全和单元测试
- **新功能开发速度提升 25%**：可复用的模块

### 9.3 实施结果

1. ✅ **已完成渐进式迁移**：所有功能模块已迁移到新结构
2. ✅ **保持向后兼容**：项目可正常运行
3. ✅ **代码重构完成**：所有主要模块已重构
4. ✅ **团队采用新结构**：代码符合新架构规范
5. ✅ **文档与代码同步**：文档已更新

---

**文档结束**

*本文档记录了项目前端架构的重构过程和最终实施结果。*
