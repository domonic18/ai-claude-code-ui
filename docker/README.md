# Docker 镜像构建说明

本目录包含不同用途的 Dockerfile。

## Dockerfile 文件

### Dockerfile.production
**用途**：生产环境完整 Web UI 镜像

**包含内容**：
- 后端 API 服务器 (backend/)
- 前端构建产物 (dist/)
- 所有运行时依赖

**启动命令**：`node backend/index.js`

**使用场景**：部署到服务器，提供完整的 Web UI 服务

**构建命令**：
```bash
docker build -f docker/Dockerfile.production -t claude-code-ui:production .
```

---

### Dockerfile.sandbox
**用途**：容器运行时镜像（多用户隔离模式）

**包含内容**：
- 后端代码 (backend/)
- 共享代码 (shared/)
- Claude Code CLI

**启动命令**：`node /app/backend/container-entrypoint.js`

**使用场景**：为每个用户创建独立的运行容器

**构建命令**：
```bash
docker build -f docker/Dockerfile.sandbox -t claude-code-sandbox:latest .
```

---

## 构建脚本

项目提供了自动化构建脚本：

```bash
# 构建生产镜像
./scripts/build-image.sh

# 推送镜像到仓库
./scripts/push-image.sh
```

构建脚本默认使用 `Dockerfile.production`。
