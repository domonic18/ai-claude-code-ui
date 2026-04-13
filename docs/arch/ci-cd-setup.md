# CI/CD 部署指南 (Jenkins Master/Agent)

## 架构概览

```
开发者 ──push──▶ GitHub
                     │
                Jenkins 每 5 分钟 Poll SCM
                检测到 main 分支有新提交
                     │
                     ▼
              Jenkins Master (Linux)
                     │
                分配任务到 macOS Agent
                     │
                     ▼
              macOS Agent (本机)
              ├── git pull (含 submodule)
              ├── npm ci && npm run build
              ├── docker build (本地构建镜像)
              ├── docker-compose down (停旧)
              ├── docker-compose up -d (启新)
              └── 健康检查
```

**核心特点**：构建和部署都在 macOS Agent 上完成，镜像不需要上传下载，不需要 CCR 中转。触发方式为 Poll SCM 轮询，无需 GitHub webhook 和内网穿透。

---

## Jenkins CI/CD 完整配置步骤

### 第 1 步：macOS 服务器 — 安装环境

```bash
# 确认已安装 Docker Desktop
docker --version
docker-compose --version

# 确认已安装 Node.js 20
node --version

# 确认已安装 Git
git --version
```

没装的先装好。

### 第 2 步：macOS 服务器 — 生成 SSH 密钥

```bash
ssh-keygen -t ed25519 -C "macos-patent-agent" -f ~/.ssh/macos_patent_agent
cat ~/.ssh/macos_patent_agent.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/macos_patent_agent
```

第三条命令会输出私钥内容，全部复制备用（包括 BEGIN 和 END 行）。

### 第 3 步：macOS 服务器 — 创建部署目录和配置

```bash
mkdir -p /Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-deploy

cat > /Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-deploy/.env.deploy << 'EOF'
NODE_ENV=production
JWT_SECRET=你的生产环境JWT密钥
CLAUDE_API_KEY=你的Claude API密钥
PORT=3001
CONTAINER_MODE=docker
EOF
```

### 第 4 步：Jenkins 网页 — 添加 macOS Agent SSH 凭据

Manage Jenkins > Credentials > System > Global > Add Credentials

| 字段 | 填什么 |
|------|--------|
| Kind | SSH Username with private key |
| ID | `macos-patent-agent-ssh` |
| Username | `zhugedongming`（你 macOS 的用户名） |
| Private Key | 选 Enter directly，粘贴第 2 步复制的私钥 |

点 Create。

### 第 5 步：Jenkins 网页 — 注册 macOS Agent 节点

Manage Jenkins > Nodes > New Node

| 字段 | 填什么 |
|------|--------|
| 节点名称 | `patent-agent` |
| Type | 固定节点 |

点确定后进入详细配置：

| 字段 | 填什么 |
|------|--------|
| 远程根目录 | `/Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-work` |
| 标签 | `macos` |
| 启动方式 | Launch agents via SSH |
| 主机 | 你 macOS 服务器的 IP（如 `192.168.8.234`） |
| Credentials | 选 `macos-patent-agent-ssh` |
| Host Key Verification Strategy | 选 **Manually provided key** |

**Host Key Verification Strategy 设置**（重要，否则连接会失败）：

1. 先在 macOS Agent 上获取主机公钥：
   ```bash
   ssh-keyscan -t ed25519 192.168.8.234
   ```
2. 将输出的内容粘贴到 "Manually provided key" 字段

点 Save。确认状态显示 Connected。

### 第 6 步：Jenkins 网页 — 添加 GitHub SSH 凭据

Jenkins 需要用 SSH 从 GitHub 拉代码，所以要配一个能访问仓库的私钥。

**方式 A（推荐）：在 macOS Agent 上生成专用密钥**

```bash
# 在 macOS Agent 服务器上执行
ssh-keygen -t ed25519 -C "jenkins-github" -f ~/.ssh/jenkins_github
cat ~/.ssh/jenkins_github      # 复制私钥，下面要用
cat ~/.ssh/jenkins_github.pub  # 复制公钥，加到 GitHub
```

然后去 GitHub 仓库 → Settings → Deploy keys → Add deploy key：
- Title 填 `jenkins-ci`
- Key 粘贴公钥内容
- 勾选 **Allow write access**（如果只需要拉代码可以不勾）

**方式 B：复用已有密钥**

如果 macOS Agent 上已经有能访问 GitHub 的密钥（比如 `~/.ssh/id_ed25519`），直接用它的私钥也行：

```bash
cat ~/.ssh/id_ed25519   # 在 macOS Agent 上执行，复制输出
```

**在 Jenkins 网页添加凭据**

Manage Jenkins > Credentials > System > Global > Add Credentials

| 字段 | 填什么 |
|------|--------|
| Kind | SSH Username with private key |
| ID | `github-ssh-key` |
| Username | `git` |
| Private Key | 选 Enter directly，粘贴上面复制的私钥 |

点 Create。

### 第 7 步：Jenkins 网页 — 创建 Pipeline Job

首页 > 新建任务

| 字段 | 填什么 |
|------|--------|
| 名称 | `patent-deploy` |
| 类型 | Pipeline |

点确定后：

| 配置项 | 填什么 |
|--------|--------|
| Build Triggers | 勾选 **Poll SCM**，日程表填 `H/5 * * * *` |
| Pipeline > Definition | Pipeline script from SCM |
| SCM | Git |
| Repository URL | `git@github.com:domonic18/ai-claude-code-ui.git` |
| Credentials | 选 `github-ssh-key` |
| Branch | `*/main` |
| Script Path | `Jenkinsfile` |

点 Save。

### 第 8 步：验证 Poll SCM 触发

Poll SCM 不需要在 GitHub 上配置 webhook。Jenkins 会每 5 分钟自动检查 main 分支是否有新提交，有变更才触发构建。

验证方法：

1. 在 Jenkins Job 页面左侧看到 "Poll SCM" 时间戳
2. 推送代码到 main 分支后，等待最多 5 分钟，Jenkins 会自动开始构建
3. 也可以手动点 "Build Now" 立即触发一次

### 第 9 步：把代码推送到 GitHub

Jenkinsfile 和 docker-compose.deploy.yml 等文件需要推送到 main 分支：

```bash
git add Jenkinsfile docker-compose.deploy.yml scripts/deploy.sh
git commit -m "feat: 添加 Jenkins CI/CD 配置"
git push origin main
```

---

## 完成后的效果

```
push 到 main 分支
      │
      ▼
Jenkins 每 5 分钟 Poll SCM 检测到新提交
      │
      ▼
分配给 macOS Agent 执行：
    1. git pull 拉代码（含 submodule）
    2. npm ci && npm run build（构建前端）
    3. npm run test（测试）
    4. docker build（构建镜像）
    5. docker-compose up -d（部署）
    6. 健康检查
```

---

## Pipeline 流程说明

Jenkinsfile 定义了 5 个阶段：

```
┌─────────────────────────────────────────────────┐
│  所有阶段在 macOS Agent 上执行                    │
│                                                  │
│  1. Checkout  → git pull（含 submodule）         │
│  2. CI: Build → npm ci + npm run build          │
│  3. CI: Test  → 单元测试                         │
│  4. CD: Build → docker build (main + sandbox)   │
│  5. CD: Deploy→ docker-compose 滚动更新          │
│                                                  │
│  镜像版本: git short commit hash                 │
│  不需要上传/下载镜像，全部在本地完成               │
└─────────────────────────────────────────────────┘
```

### 首次运行注意

第一次部署时本地没有 `claude-code-ui:base` 镜像，Jenkinsfile 会自动检测并构建 base 镜像。base 镜像包含系统依赖和 npm 包，构建时间较长（约 5-10 分钟），后续构建会跳过。

---

## 回滚

### 在 macOS 服务器上手动回滚

```bash
cd /Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-deploy

# 查看本地有哪些版本的镜像
docker images | grep claude-code

# 回滚到指定版本
./scripts/deploy.sh --rollback c354422
```

### 在 Jenkins 上回滚

找到之前成功的构建 → 点击 "Replay" 或 "Build Now"

---

## 排障

### Agent 连接不上

```bash
# 在 macOS 上检查 SSH 服务
sudo systemsetup -getremotelogin
# 开启 SSH
sudo systemsetup -setremotelogin on

# 检查防火墙
# 系统偏好设置 > 安全性与隐私 > 防火墙
```

### SSH Host Key Verification 失败

错误特征：`No Known Hosts file was found` 或 `Key exchange was not finished`

**推荐修复**：修改 Agent 节点的 Host Key Verification Strategy：

1. Manage Jenkins > Nodes > patent-agent > Configure
2. 将 **Host Key Verification Strategy** 改为 **Manually provided key**
3. 在 macOS Agent 上获取公钥：`ssh-keyscan -t ed25519 <agent-ip>`
4. 将输出粘贴到 "Manually provided key" 字段

**备选方案**：在 Jenkins 容器内手动创建 known_hosts：

```bash
docker exec -it -u root <jenkins-container> bash
mkdir -p /var/jenkins_home/.ssh
ssh-keyscan -t ed25519 <agent-ip> >> /var/jenkins_home/.ssh/known_hosts
chown -R jenkins:jenkins /var/jenkins_home/.ssh
chmod 700 /var/jenkins_home/.ssh
chmod 644 /var/jenkins_home/.ssh/known_hosts
```

### Docker 命令权限不足

```bash
# 确保 Jenkins Agent 用户在 docker 组中
sudo dseditgroup -o edit -a <username> -t user docker
# 或者重启 Docker Desktop 后重试
```

### 查看部署日志

```bash
# 查看容器状态
docker ps -a | grep claude-code

# 查看应用日志
docker-compose -f /Users/zhugedongming/Code/patent/ai-claude-code-ui-jenkins-deploy/docker-compose.deploy.resolved.yml logs -f --tail 100

# 健康检查
curl -s http://localhost:3001/health
```

---

## 与手动部署的区别

| 项目 | 之前（手动） | 现在（Jenkins Agent） |
|------|-------------|---------------------|
| 触发方式 | 手动运行脚本 | Poll SCM 每 5 分钟自动检测 |
| 构建位置 | 开发机 | macOS Agent 本地 |
| 镜像传递 | push CCR → pull | 不需要，本地直接用 |
| 需要腾讯云 CCR | 是 | 否（可选做备份） |
| 部署方式 | 手动 docker-compose up | 自动化全流程 |
