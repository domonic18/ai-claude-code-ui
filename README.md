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

# 可用模型列表（必需，格式：model:provider|model:provider）
AVAILABLE_MODELS=glm-4.7:Zhipu GLM|glm-5:Zhipu GLM

# CORS 配置
CORS_ORIGINS=http://localhost:3001

# Cookie 安全配置
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

<details>
<summary>完整环境变量清单</summary>

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | 否 | `3001` | 服务监听端口 |
| `NODE_ENV` | 是 | - | `development` 或 `production` |
| `JWT_SECRET` | 是 | - | JWT 签名密钥，生产环境务必使用强随机字符串 |
| `DATA_DIR` | 生产 | `/var/lib/claude-code` | 数据持久化目录 |
| `CONTAINER_MODE` | 否 | `enabled` | 是否启用容器隔离 |
| `CONTAINER_IMAGE` | 否 | `claude-code-sandbox:latest` | 沙箱容器镜像 |
| `CONTAINER_NETWORK` | 否 | `claude-code-network` | Docker 网络名称 |
| `ANTHROPIC_BASE_URL` | 是 | - | AI API 端点 |
| `ANTHROPIC_AUTH_TOKEN` | 是 | - | AI API 认证令牌 |
| `ANTHROPIC_MODEL` | 是 | - | 默认模型名称 |
| `AVAILABLE_MODELS` | 是 | - | 可选模型列表（`model:provider` 格式，`\|` 分隔） |
| `SAML_ENABLED` | 否 | `false` | 启用 SAML SSO |
| `CORS_ORIGINS` | 否 | `http://localhost:3001` | 允许的跨域来源 |
| `COOKIE_SECURE` | 否 | `false` | Cookie Secure 标志（HTTPS 时设为 `true`） |
| `COOKIE_SAMESITE` | 否 | `lax` | Cookie SameSite 策略 |
| `FRONTEND_URL` | 否 | `http://localhost:3001/chat` | 前端地址（用于 SAML 回调重定向） |

</details>

# 🏗️ 生产部署

## 部署架构

```
┌─────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  Nginx   │───▶│  Claude Code UI App  │───▶│  AI API Service  │
│ (反向代理)│    │  (Docker Container)  │    │  (外部服务)       │
└─────────┘    └──────┬───────────────┘    └─────────────────┘
                      │
               ┌──────┴──────┐
               │  Docker API  │
               │  (容器管理)   │
               └─────────────┘
```

## 前置条件

- Docker Engine 20.10+
- Docker Compose v2+
- 至少 2 CPU 核心与 4GB 内存
- 宿主机已创建数据目录：`mkdir -p /var/lib/claude-code`

## 部署步骤

### 1. 构建并推送镜像

```bash
# 构建镜像（带版本号）
./scripts/build-image.sh

# 推送到远程仓库
./scripts/push-image.sh
```

### 2. 配置生产环境

在目标机器创建 `.env.deploy` 文件，参考 `.env.deploy` 模板配置以下关键项：

```bash
# 必须修改的配置
JWT_SECRET=<生成一个 32 位以上的随机字符串>
ANTHROPIC_AUTH_TOKEN=<你的 API Key>
ANTHROPIC_BASE_URL=<你的 API 端点>
AVAILABLE_MODELS=<你的模型列表>

# HTTPS 生产环境
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
CORS_ORIGINS=https://your-domain.com

# SAML SSO（可选）
SAML_ENABLED=true
SAML_ENTITY_ID=<IdP Entity ID>
SAML_SSO_URL=<IdP SSO URL>
SAML_IDP_CERTIFICATE=<IdP 证书>
```

### 3. 启动服务

```bash
# 启动服务（使用远程镜像）
docker-compose -f docker-compose.deploy.yml up -d

# 查看日志
docker-compose -f docker-compose.deploy.yml logs -f

# 停止服务
docker-compose -f docker-compose.deploy.yml down
```

### 4. 反向代理配置（推荐 Nginx）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## 运维操作

```bash
# 查看容器健康状态
docker inspect --format='{{.State.Health.Status}}' claude-code-app

# 查看实时日志
docker-compose -f docker-compose.deploy.yml logs -f --tail=100

# 更新镜像版本
docker-compose -f docker-compose.deploy.yml pull
docker-compose -f docker-compose.deploy.yml up -d

# 数据备份
tar -czf claude-code-backup-$(date +%Y%m%d).tar.gz /var/lib/claude-code/
```

# 🔒 安全说明

## 认证与授权

- **JWT 会话认证**：所有 API 端点需要有效 JWT Token，Token 通过登录接口获取
- **SAML SSO**（可选）：支持企业级 SAML 2.0 单点登录，配置 `SAML_ENABLED=true` 启用
- **Cookie 安全**：生产环境建议启用 `COOKIE_SECURE=true` 和 `COOKIE_SAMESITE=strict`

## 容器隔离

- 每个用户会话运行在独立的 Docker 容器中，实现资源和网络隔离
- 容器使用 Seccomp 和 AppArmor 配置限制系统调用
- 容器资源限制（CPU/内存）通过 `docker-compose.deploy.yml` 中的 `deploy.resources` 配置
- 容器以 `no-new-privileges` 安全选项运行，禁止权限提升

## 数据安全

- JWT 密钥和 API Key 通过环境变量注入，不写入代码或镜像
- 日志系统不记录敏感数据（Token、对话内容、个人信息）
- 文件操作经过路径安全检查，防止路径遍历攻击
- SQLite 数据库文件存储在持久化卷中，不暴露到容器外部

## 网络安全

- CORS 配置通过 `CORS_ORIGINS` 环境变量控制允许的前端域名
- 用户沙箱容器运行在独立 Docker 网络中（`claude-code-network`）
- 容器间网络隔离，用户容器无法访问主应用服务

## 工具安全

- AI Agent 工具默认禁用，需要用户主动启用
- 敏感操作（文件删除、命令执行等）经过二次确认
- 文件路径操作经过白名单校验

## 安全最佳实践

1. **定期更新**：保持 Docker 镜像和依赖包更新
2. **密钥轮换**：定期更换 JWT_SECRET 和 API Key
3. **HTTPS 部署**：生产环境必须使用 HTTPS，配合 Nginx 反向代理
4. **最小权限**：Docker 容器遵循最小权限原则运行
5. **审计日志**：定期检查应用日志中的异常访问模式

# 🔧 故障排除

## 常见问题

### 服务启动失败

| 症状 | 可能原因 | 解决方案 |
|------|----------|----------|
| `EADDRINUSE: address already in use` | 端口被占用 | 修改 `PORT` 环境变量或停止占用进程：`lsof -i :3001` |
| `Cannot connect to the Docker daemon` | Docker 未启动 | 启动 Docker：`systemctl start docker` |
| `JWT_SECRET is not set` | 环境变量缺失 | 在 `.env` 或 `.env.deploy` 中设置 `JWT_SECRET` |
| 容器启动后立即退出 | 镜像不存在或损坏 | 检查 `CONTAINER_IMAGE` 配置，重新拉取/构建镜像 |

### WebSocket 连接问题

- **症状**：聊天消息不实时更新，需要刷新页面
- **排查**：检查 Nginx 反向代理是否配置了 WebSocket 升级头（`Upgrade`/`Connection`）
- **排查**：确认 `proxy_read_timeout` 设置足够长（建议 86400 秒）
- **排查**：检查 `CORS_ORIGINS` 是否包含前端域名

### 容器相关问题

- **用户容器无法启动**：检查 Docker socket 是否挂载（`/var/run/docker.sock`）
- **容器权限错误**：确认数据目录权限（`chmod -R 777 /var/lib/claude-code`）
- **容器网络不通**：检查 `CONTAINER_NETWORK` 配置和网络是否已创建

### SAML 登录问题

- **IdP 返回 500 错误**：尝试设置 `SAML_ENABLE_REQUEST_SIGNING=false`
- **回调地址不匹配**：确认 `SAML_CALLBACK_URL` 与 IdP 配置一致
- **登录后白屏**：检查 `FRONTEND_URL` 配置是否正确

## 获取帮助

- 查看 [架构概述](docs/arch/architecture-overview.md) 了解系统设计
- 查看 [API 文档](docs/api/README.md) 了解接口详情
- 查看 [用户手册](docs/user_operate/用户手册.md) 了解功能使用

# 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS + CodeMirror |
| 后端 | Node.js + Express + WebSocket + SQLite |
| AI | Claude Code SDK / Cursor CLI / OpenAI Codex |
| 隔离 | Docker 容器 (每用户独立环境) |

> 详细技术栈版本及项目结构见 [项目结构文档](docs/ai-context/project-structure.md)，API 参考见 [API 文档](docs/api/README.md)。

## 目录结构

| 目录 | 用途 |
|------|------|
| `frontend/` | React 前端应用 |
| `backend/` | Express 后端服务 |
| `shared/` | 前后端共享的常量和工具 |
| `docker/` | Dockerfile 和容器配置 |
| `docs/` | 架构文档、API 文档、用户手册 |
| `scripts/` | 构建和发布脚本 |
| `extensions/` | Git 子模块（Claude Code 技能扩展） |

### 关于 extensions/ 子模块

`extensions/` 目录是一个 Git 子模块，包含 Claude Code 的第三方技能扩展（来自 Claude Code 官方仓库）。

**重要说明：**
- 该子模块内部存在深达 13 层的目录嵌套，这是由于 OOXML 文档格式的 Schema 结构导致的，属于第三方代码的固有特征
- **本项目自身的代码结构最大深度为 5 层**，完全符合行业标准（6 层以内）
- 子模块的深度嵌套不影响本项目的代码质量和可维护性

如需更新子模块：
```bash
git submodule update --remote --merge
```

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
