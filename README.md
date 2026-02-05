<div align="center">
  <img src="public/logo.svg" alt="Claude Code UI" width="64" height="64">
  <h1>Claude Code UI</h1>
  <p>为 Claude Code、Cursor CLI 和 OpenAI Codex 提供的多用户 Web 界面</p>
</div>

# ✨ 项目特色

1. **多用户架构** - 基于 SQLite 的用户认证和会话管理，支持多用户独立使用
2. **容器隔离** - 每个用户拥有独立的 Docker 容器环境，确保安全和隔离
3. **响应式设计** - 完美支持桌面端和移动端，随时随地访问
4. **多 AI 支持** - 集成 Claude Code、Cursor CLI 和 OpenAI Codex
5. **实时通信** - 基于 WebSocket 的流式响应，实时获取 AI 回复
6. **文件管理** - 内置文件浏览器，支持在线查看和编辑代码
7. **会话管理** - 自动保存对话历史，支持恢复和继续之前的对话

# 📸 项目截图

<div align="center">

<table>
<tr>
<td align="center">
<h3>桌面端界面</h3>
<img src="public/screenshots/desktop-main.png" alt="Desktop Interface" width="400">
</td>
<td align="center">
<h3>移动端体验</h3>
<img src="public/screenshots/mobile-chat.png" alt="Mobile Interface" width="250">
</td>
</tr>
</table>

</div>

# 🚀 快速开始

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/domonic18/ai-claude-code-ui.git
cd ai-claude-code-ui

# 拉取 extensions 子模块（按需）
git submodule update --init --recursive

# 安装依赖
npm install

# 构建 base 镜像（仅首次需要，使用 docker build）
docker build -f docker/Dockerfile.base -t claude-code-ui:base .

# 构建前端
npm run build

# 构建沙箱镜像（用于用户隔离容器，仅首次需要）
docker build -f docker/Dockerfile.sandbox -t claude-code-sandbox:latest .

# 构建并启动服务
docker-compose up
```

> **说明**：本地开发使用 `docker build` 构建镜像；发布到远程仓库使用 `scripts/build-image.sh` 脚本。

访问 http://localhost:3001

### 代码修改后操作

| 改动类型 | 操作 |
|---------|------|
| 前端代码 | `npm run build` → 刷新浏览器 |
| 后端代码 | `docker-compose restart app` |
| 前端+后端 | `npm run build` → `docker-compose restart app` → 刷新浏览器 |
| Dockerfile | `docker-compose build` → `docker-compose up` |

### 子模块操作

本项目使用 Git 子模块管理 extensions 目录，以下是一些常用操作：

```bash
# 更新子模块到最新版本
git submodule update --remote --merge
```

# ⚙️ 配置说明

## 环境变量

在项目根目录创建 `.env` 文件：

```bash
# 服务器配置
PORT=3001
NODE_ENV=development

# JWT 密钥（生产环境请修改）
JWT_SECRET=your-secret-key-change-in-production

# Docker 容器配置
CONTAINER_MODE=enabled
CONTAINER_IMAGE=claude-code-sandbox:latest

# Claude API 配置（可选）
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
ANTHROPIC_MODEL=glm-4.7
```

## Docker 部署

### 构建并推送镜像

```bash
# 构建镜像（带版本号）
./scripts/build-image.sh

# 推送到远程仓库
./scripts/push-image.sh
```

### 目标机器部署

```bash
# 启动服务（使用远程镜像）
docker-compose -f docker-compose.deploy.yml up -d

# 查看日志
docker-compose -f docker-compose.deploy.yml logs -f

# 停止服务
docker-compose -f docker-compose.deploy.yml down
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `cloudcli` | 启动服务 |
| `cloudcli status` | 显示配置状态 |
| `cloudcli update` | 更新到最新版本 |
| `cloudcli --port 8080` | 指定端口启动 |

# 📚 主要功能

## 用户管理
- 多用户注册和登录
- JWT Token 认证
- 用户会话隔离

## 项目管理
- 自动发现 Claude Code 项目
- 项目操作：重命名、删除、组织
- 会话历史管理

## 聊天界面
- 实时流式响应
- 会话恢复和继续
- 多格式支持（文本、代码块、文件引用）
- 图片上传支持

## 文件浏览器
- 交互式文件树
- 在线查看和编辑代码
- 语法高亮支持
- 文件操作：创建、重命名、删除

## 容器管理
- 每用户独立容器
- 自动容器创建和销毁
- 资源使用监控
- 空闲容器自动清理

# 🛠️ 技术栈

## 后端
- **Node.js** + **Express** - RESTful API 服务器
- **WebSocket** - 实时通信
- **SQLite** - 用户数据存储
- **Docker** - 容器隔离

## 前端
- **React 18** - 现代组件架构
- **Vite** - 快速构建工具
- **Tailwind CSS** - 样式框架
- **CodeMirror** - 代码编辑器

## AI 集成
- **@anthropic-ai/claude-agent-sdk** - Claude Code SDK
- **Cursor CLI** - Cursor 集成
- **OpenAI Codex** - Codex 集成

# 📄 版权声明

## 项目来源

本项目基于原 [Claude Code UI](https://github.com/siteboon/claudecodeui) 项目开发，向原项目作者 **Siteboon** 致敬。

原项目仓库：https://github.com/siteboon/claudecodeui

## 开源协议

[GNU General Public License v3.0](/LICENSE) | Copyright © 2024 [Siteboon](https://github.com/siteboon)

## 贡献说明

欢迎开发者为本项目贡献代码，共同推进 Claude Code UI 的发展。

---

<div align="center">
  <strong>为 Claude Code、Cursor 和 Codex 社区用心打造</strong>
</div>
