# Claude Code UI - 项目结构

本文档提供了项目的完整技术栈和文件树结构。**AI 智能体必须先阅读此文件以了解项目组织，然后再进行任何更改。**

## 技术栈

### 后端技术
- **Node.js 20+** 与 **npm 10+** - 依赖管理和打包
- **Express.js 4.18** - 带中间件系统的 Web 框架
- **WebSocket (ws) 8.14** - 实时双向通信
- **better-sqlite3 12.2** - 嵌入式关系型数据库
- **Dockerode 4.0** - Docker API 客户端
- **@anthropic-ai/claude-agent-sdk 0.2** - Claude AI 代理 SDK

### 集成服务与 API
- **Anthropic Claude API** - AI 对话和代码生成
- **OpenAI Codex SDK** - 代码补全和生成
- **GitHub API (via @octokit/rest)** - Git 操作和仓库管理
- **MCP (Model Context Protocol)** - 模型上下文协议服务器集成

### 实时通信
- **ws 8.14** - WebSocket 服务器和客户端
- **node-pty 1.1** - 伪终端进程管理

### 开发与质量工具
- **TypeScript 5.9** - 静态类型检查
- **Vite 7.0** - 前端构建工具和开发服务器
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化

### 前端技术
- **React 18.3** - UI 框架
- **React Router DOM 6.8** - 客户端路由
- **Vite 7.0** - 开发和构建工具
- **Tailwind CSS 3.4** - 样式框架
- **i18next 25.7** - 国际化
- **@tanstack/react-query 5.90** - 服务端状态管理
- **CodeMirror 6** - 代码编辑器组件
- **xterm 5.5** - 终端组件

### 未来技术
- **多用户容器隔离** - Docker 容器级别的用户隔离（规划中）
- **Kubernetes 支持** - 容器编排和横向扩展（未来）
- **监控和告警** - 生产环境可观测性（未来）

## 完整项目结构

```
ai-claude-code-ui/
├── README.md                           # 项目概览和设置
├── CLAUDE.md                           # 主 AI 上下文文件
├── package.json                        # 项目依赖和脚本
├── .gitignore                          # Git 忽略模式
├── .env.example                        # 环境变量示例
├── tsconfig.json                       # TypeScript 配置
├── vite.config.js                      # Vite 构建配置
├── tailwind.config.js                  # Tailwind CSS 配置
├── docker-compose.yml                  # Docker Compose 配置
├── backend/                            # 后端应用
│   ├── index.js                        # 主服务入口
│   ├── cli.js                          # CLI 入口点
│   ├── config/                         # 配置管理
│   │   ├── config.js                   # 应用配置
│   │   ├── express-config.js           # Express 中间件配置
│   │   └── env.js                      # 环境变量加载
│   ├── database/                       # 数据库
│   │   ├── db.js                       # 数据库初始化
│   │   └── schema.sql                  # 数据库模式
│   ├── services/                       # 业务服务
│   │   ├── container/                  # 容器管理服务
│   │   ├── core/                       # 核心服务
│   │   ├── execution/                  # 执行服务
│   │   ├── files/                      # 文件操作服务
│   │   ├── mcp/                        # MCP 服务器集成
│   │   ├── projects/                   # 项目管理服务
│   │   ├── sessions/                   # 会话管理服务
│   │   ├── settings/                   # 设置服务
│   │   └── workspace/                  # 工作区管理
│   ├── routes/                         # API 路由
│   │   ├── api/                        # REST API 路由
│   │   ├── core/                       # 核心功能路由
│   │   ├── integrations/               # 集成路由
│   │   └── tools/                      # 工具路由
│   ├── controllers/                    # 控制器
│   │   ├── api/                        # API 控制器
│   │   └── core/                       # 核心控制器
│   ├── middleware/                     # 中间件
│   │   ├── auth.js                     # 认证中间件
│   │   └── ...
│   ├── utils/                          # 工具函数
│   │   ├── env.js                      # 环境工具
│   │   ├── logger.js                   # 日志工具
│   │   └── ...
│   ├── websocket/                      # WebSocket 服务
│   │   ├── server.js                   # WebSocket 服务器
│   │   ├── writer.js                   # 消息写入器
│   │   └── handlers/                   # 消息处理器
│   └── tests/                          # 测试文件
│       ├── unit/                       # 单元测试
│       └── integration/                # 集成测试
├── frontend/                           # 前端应用
│   ├── index.html                      # HTML 入口
│   ├── main.tsx                        # React 入口
│   ├── App.tsx                         # 根组件
│   ├── index.css                       # 全局样式
│   ├── features/                       # 功能模块（按业务功能组织）
│   │   ├── auth/                       # 认证功能
│   │   │   ├── components/             # 认证组件
│   │   │   ├── hooks/                  # 认证 hooks
│   │   │   ├── services/               # 认证服务
│   │   │   ├── types/                  # 类型定义
│   │   │   └── index.ts
│   │   ├── chat/                       # 聊天功能
│   │   │   ├── components/             # 聊天组件
│   │   │   ├── hooks/                  # 聊天 hooks
│   │   │   ├── services/               # 聊天服务
│   │   │   ├── types/                  # 类型定义
│   │   │   ├── utils/                  # 工具函数
│   │   │   ├── constants/              # 常量
│   │   │   └── index.ts
│   │   ├── editor/                     # 编辑器功能
│   │   │   ├── components/             # 编辑器组件
│   │   │   ├── hooks/                  # 编辑器 hooks
│   │   │   ├── types/                  # 类型定义
│   │   │   ├── constants/              # 常量
│   │   │   └── index.ts
│   │   ├── file-explorer/              # 文件浏览器功能
│   │   │   ├── components/             # 组件
│   │   │   ├── hooks/                  # hooks
│   │   │   ├── services/               # 服务
│   │   │   ├── types/                  # 类型
│   │   │   └── index.ts
│   │   ├── settings/                   # 设置功能
│   │   │   ├── components/             # 设置组件
│   │   │   │   ├── agent/              # Agent 设置
│   │   │   │   ├── mcp/                # MCP 设置
│   │   │   │   └── common/             # 通用组件
│   │   │   ├── hooks/                  # 设置 hooks
│   │   │   ├── services/               # 设置服务
│   │   │   ├── types/                  # 类型定义
│   │   │   ├── validators/             # 验证器
│   │   │   ├── utils/                  # 工具函数
│   │   │   ├── constants/              # 常量
│   │   │   └── index.ts
│   │   ├── sidebar/                    # 侧边栏功能
│   │   │   ├── components/             # 侧边栏组件
│   │   │   ├── hooks/                  # hooks
│   │   │   ├── services/               # 服务
│   │   │   ├── types/                  # 类型
│   │   │   ├── utils/                  # 工具函数
│   │   │   ├── constants/              # 常量
│   │   │   └── index.ts
│   │   ├── system/                     # 系统功能
│   │   │   └── index.ts
│   │   └── terminal/                   # 终端功能
│   │       ├── components/             # 终端组件
│   │       ├── hooks/                  # hooks
│   │       ├── types/                  # 类型
│   │       ├── constants/              # 常量
│   │       └── index.ts
│   ├── shared/                         # 共享模块
│   │   ├── components/                 # 共享 UI 组件
│   │   │   ├── ui/                     # 基础 UI 组件
│   │   │   ├── layout/                 # 布局组件
│   │   │   └── common/                 # 通用组件
│   │   ├── contexts/                   # React Context
│   │   │   ├── AuthContext.tsx
│   │   │   ├── WebSocketContext.tsx
│   │   │   └── ...
│   │   ├── hooks/                      # 共享 hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── ...
│   │   ├── services/                   # 共享服务
│   │   │   ├── api/                    # API 客户端
│   │   │   └── storage/                # 存储服务
│   │   ├── types/                      # 共享类型
│   │   ├── utils/                      # 共享工具函数
│   │   ├── constants/                  # 共享常量
│   │   ├── i18n/                       # 国际化
│   │   ├── libs/                       # 第三方库封装
│   │   ├── validators/                 # 共享验证器
│   │   └── assets/                     # 静态资源
│   ├── pages/                          # 页面组件
│   │   ├── Chat/                       # 聊天页面
│   │   ├── Settings/                   # 设置页面
│   │   ├── Homepage/                   # 首页
│   │   ├── LoadingPage.tsx             # 加载页面
│   │   ├── NotFoundPage.tsx            # 404 页面
│   │   ├── ErrorPage.tsx               # 错误页面
│   │   └── index.ts
│   ├── router/                         # 路由配置
│   │   └── AppRouter.tsx               # 路由组件
│   ├── config/                         # 配置文件
│   │   └── routes.config.ts            # 路由配置
│   └── lib/                            # 第三方库
├── shared/                             # 前后端共享代码
│   └── ...
├── docs/                               # 文档
│   ├── README.md                       # 文档入口
│   ├── ai-context/                     # AI 特定文档
│   │   ├── docs-overview.md            # 文档架构
│   │   ├── project-structure.md        # 此文件
│   │   ├── system-integration.md       # 集成模式
│   │   ├── deployment-infrastructure.md # 基础设施
│   │   └── handoff.md                  # 任务管理
│   ├── arch/                           # 架构文档
│   │   ├── architecture-overview.md    # 架构概述
│   │   ├── core-modules-design.md      # 核心模块设计
│   │   ├── frontend-organization-structure.md # 前端结构
│   │   ├── multi-user-sandbox-evaluation.md # 沙箱评估
│   │   ├── security-deployment-config.md # 安全配置
│   │   ├── data-storage-design.md      # 数据存储设计
│   │   └── multi-account-settings-and-mcp-implementation.md # 多账户实现
│   ├── requirement/                    # 需求文档
│   │   └── multi-account-settings-and-mcp.md
│   └── plan/                           # 计划文档
│       └── frontend-pages-i18n-homepage-usermenu.md
├── scripts/                            # 自动化脚本
│   └── release.sh                      # 发布脚本
├── docker/                             # Docker 配置
│   └── ...
├── public/                             # 静态资源
│   └── ...
└── workspace/                          # 工作区数据
    ├── database/                       # 用户数据库
    ├── users/                          # 用户数据
    └── containers/                     # 容器数据
```

---

*此文档描述了 Claude Code UI 项目的完整技术栈和文件树结构。*