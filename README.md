<div align="center">
  <img src="public/logo.svg" alt="Claude Code UI" width="64" height="64">
  <h1>Claude Code UI</h1>
  <p>为 Claude Code、Cursor CLI 和 OpenAI Codex 提供的多用户 Web 界面</p>
</div>

# ✨ 项目特色

多用户 Web 界面，为 Claude Code、Cursor CLI 和 OpenAI Codex 提供容器隔离的 AI 编码体验。

> 完整功能介绍见 [用户手册](docs/user_operate/用户手册.md)，架构设计见 [架构概述](docs/arch/architecture-overview.md)。

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

## 首次设置（仅需一次）

```bash
# 克隆仓库
git clone https://github.com/domonic18/ai-claude-code-ui.git
cd ai-claude-code-ui

# 拉取 extensions 子模块（按需）
git submodule update --init --recursive

# 安装依赖
npm install

# 构建基础镜像
./scripts/build-image.sh
```

## 日常开发

```bash
# 启动开发环境
npm run dev
```

## 修改代码后

| 修改类型 | 操作 |
|---------|------|
| 前端代码 | Vite 热时编译，浏览器刷新即可 |
| 后端代码 | 无需操作（Node.js 热重载） |
| 沙箱代码 | `docker build -f docker/Dockerfile.sandbox -t claude-code-sandbox:latest`，重启后端服务 |

访问 http://localhost:3001

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

# 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS + CodeMirror |
| 后端 | Node.js + Express + WebSocket + SQLite |
| AI | Claude Code SDK / Cursor CLI / OpenAI Codex |
| 隔离 | Docker 容器 (每用户独立环境) |

> 详细技术栈版本及项目结构见 [项目结构文档](docs/ai-context/project-structure.md)，API 参考见 [API 文档](docs/api/README.md)。

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
