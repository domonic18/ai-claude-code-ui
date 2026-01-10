# 多用户 Claude Code 系统 - 安全与部署配置

> **文档版本**: 1.0
> **创建时间**: 2026-01-10
> **所属架构**: Docker + Seccomp 容器隔离

---

## 目录

- [一、安全策略配置](#一安全策略配置)
- [二、部署架构](#二部署架构)

---

## 一、安全策略配置

### 1.1 Seccomp 策略

#### 1.1.1 默认 Seccomp 配置

创建文件 `workspace/containers/seccomp/claude-code.json`：

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_X32"
  ],
  "syscalls": [
    {
      "name": "access",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "arch_prctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "brk",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "capget",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "capset",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chmod",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "chown",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "clone",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "close",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "connect",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "creat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup2",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "dup3",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_create1",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_ctl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_pwait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "epoll_wait",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "execve",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "exit",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "exit_group",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "faccessat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchmod",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchmodat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchown",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fchownat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fcntl",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fstatfs",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "fsync",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ftruncate",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "futex",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getcwd",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getdents",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getdents64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getegid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "geteuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getgroups",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpeername",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getpid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getppid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "getuid",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ioctl",
      "action": "SCMP_ACT_ALLOW",
      "args": [
        {
          "index": 1,
          "value": 21505,
          "op": "SCMP_CMP_EQ"
        },
        {
          "index": 1,
          "value": 21523,
          "op": "SCMP_CMP_EQ"
        }
      ]
    },
    {
      "name": "io_setup",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "io_getevents",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "lseek",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "lstat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "madvise",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mkdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mkdirat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mmap",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mprotect",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "mremap",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "munmap",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "nanosleep",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "newfstatat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "open",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "openat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pipe",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pipe2",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "poll",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "ppoll",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pread64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "pwrite64",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "read",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "readlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "readlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "recvfrom",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "recvmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rename",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "renameat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rmdir",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigaction",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigprocmask",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "rt_sigreturn",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sendmsg",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sendto",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "setsockopt",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "shutdown",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "sigaltstack",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "socket",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "socketpair",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "stat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "statfs",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "symlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "symlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "tgkill",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "time",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "tkill",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "uname",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "unlink",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "unlinkat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "utime",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "utimensat",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "wait4",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "write",
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "name": "writev",
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

**说明**：
- `defaultAction: "SCMP_ACT_ERRNO"` - 默认拒绝所有系统调用
- 只允许必要的系统调用用于 Node.js 运行
- 禁止危险系统调用（如 `mount`, `umount`, `ptrace` 等）

#### 1.1.2 企业级 Seccomp 配置

对于企业用户，可以创建更严格的策略 `claude-code-enterprise.json`，进一步限制：
- 限制网络相关系统调用
- 限制进程控制相关系统调用
- 增加更多审计规则

### 1.2 AppArmor 配置

创建文件 `workspace/containers/apparmor/claude-code`：

```profile
# AppArmor profile for Claude Code containers
#include <tunables/global>

profile claude-code-default flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nodejs>

  # 允许访问工作目录
  /workspace/** rw,
  /root/.claude/** rw,

  # 允许访问 /tmp
  /tmp/** rw,

  # 允许读取系统库
  /usr/lib/** r,
  /lib/** r,
  /lib64/** r,

  # 允许 Node.js 运行时
  /usr/bin/node ix,
  /usr/local/bin/node ix,

  # 禁止访问 Docker Socket
  deny /var/run/docker.sock rw,

  # 禁止访问宿主机文件系统
  deny /home/** rw,
  deny /root/** rw,
  deny /etc/** rw,

  # 禁止特权操作
  deny capability sys_admin,
  deny capability sys_ptrace,
  deny capability sys_module,

  # 网络限制
  network inet stream,
  network inet dgram,
  deny network raw,

  # 审计日志
  audit deny /var/log/** w,
}
```

加载 AppArmor 配置：

```bash
# 复制配置文件
sudo cp workspace/containers/apparmor/claude-code /etc/apparmor.d/

# 重新加载配置
sudo apparmor_parser -r /etc/apparmor.d/claude-code

# 验证配置
sudo aa-status
```

### 1.3 网络隔离配置

#### 1.3.1 默认网络模式

使用 Docker 默认的 `bridge` 网络：

```javascript
const containerConfig = {
  HostConfig: {
    NetworkMode: 'bridge'
  }
};
```

#### 1.3.2 用户隔离网络（可选）

为需要额外隔离的用户创建独立网络：

```javascript
async createUserNetwork(userId) {
  const networkName = `claude-network-${userId}`;

  try {
    await this.docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      Internal: true,  // 禁止访问外网
      IPAM: {
        Config: [{
          Subnet: `10.${userId % 256}.0.0/24`
        }]
      }
    });

    return networkName;
  } catch (error) {
    if (error.statusCode === 409) {
      return networkName;  // 网络已存在
    }
    throw error;
  }
}
```

#### 1.3.3 容器间通信控制

```javascript
// 禁止容器间通信
const networkConfig = {
  Driver: 'bridge',
  Options: {
    'com.docker.network.bridge.enable_icc': 'false'
  }
};
```

### 1.4 资源限制配置

#### 1.4.1 CPU 限制

```javascript
const cpuLimits = {
  free: {
    cpuQuota: 50000,      // 0.5 CPU
    cpuPeriod: 100000,
    cpuShares: 512        // 相对权重
  },
  pro: {
    cpuQuota: 200000,     // 2 CPU
    cpuPeriod: 100000,
    cpuShares: 1024
  },
  enterprise: {
    cpuQuota: 400000,     // 4 CPU
    cpuPeriod: 100000,
    cpuShares: 2048
  }
};
```

#### 1.4.2 内存限制

```javascript
const memoryLimits = {
  free: {
    memory: 1 * 1024 * 1024 * 1024,      // 1GB
    memorySwap: 2 * 1024 * 1024 * 1024,  // 2GB (含 swap)
    memoryReservation: 512 * 1024 * 1024 // 512MB 软限制
  },
  pro: {
    memory: 4 * 1024 * 1024 * 1024,      // 4GB
    memorySwap: 8 * 1024 * 1024 * 1024,  // 8GB
    memoryReservation: 2 * 1024 * 1024 * 1024
  },
  enterprise: {
    memory: 8 * 1024 * 1024 * 1024,      // 8GB
    memorySwap: 16 * 1024 * 1024 * 1024, // 16GB
    memoryReservation: 4 * 1024 * 1024 * 1024
  }
};
```

#### 1.4.3 磁盘限制

```javascript
const diskLimits = {
  free: {
    diskQuota: 5 * 1024 * 1024 * 1024    // 5GB
  },
  pro: {
    diskQuota: 20 * 1024 * 1024 * 1024   // 20GB
  },
  enterprise: {
    diskQuota: 50 * 1024 * 1024 * 1024   // 50GB
  }
};
```

#### 1.4.4 进程数限制

```javascript
const processLimits = {
  free: {
    pidsLimit: 100    // 最多 100 个进程
  },
  pro: {
    pidsLimit: 500
  },
  enterprise: {
    pidsLimit: 1000
  }
};
```

### 1.5 安全检查清单

部署前必须完成的安全检查：

```
□ Seccomp 策略已配置并测试
□ AppArmor 配置已加载
□ 容器不以特权模式运行
□ 容器无法访问 Docker Socket
□ 容器无法访问宿主机文件系统
□ 资源限制已配置
□ 网络隔离已配置
□ 用户输入验证已实现
□ 路径遍历防护已实现
□ 日志审计已启用
□ 敏感数据已加密存储
□ JWT Token 安全配置
□ HTTPS/TLS 已启用
□ 定期安全更新机制
□ 容器镜像扫描
□ 漏洞监控和告警
```

---

## 二、部署架构

### 2.1 单服务器部署

#### 2.1.1 服务器配置要求

```
硬件配置:
- CPU: 8 核
- 内存: 32GB
- 磁盘: 500GB SSD
- 网络: 1Gbps

软件环境:
- 操作系统: Ubuntu 22.04 LTS / Debian 12
- Docker: 24.x 或更高版本
- Node.js: 20.x
- Nginx: 1.24+
```

#### 2.1.2 部署架构图

```
┌─────────────────────────────────────────────────────────┐
│                    单服务器部署架构                       │
└─────────────────────────────────────────────────────────┘

部署组件:
├── Nginx (反向代理)
│   ├── SSL 终止
│   ├── 负载均衡
│   └── 静态文件服务
│
├── Claude Code 主应用
│   ├── Express HTTP 服务器
│   ├── WebSocket 服务器
│   └── SQLite 数据库
│
├── Docker
│   ├── Docker Daemon
│   ├── 容器运行时
│   └── 容器网络
│
└── 监控组件
    ├── Prometheus (指标收集)
    ├── Grafana (可视化)
    └── Loki (日志聚合)

用户容量估算:
- Free 用户: ~30-50 并发用户 (0.5核 + 1GB)
- Pro 用户: ~15-25 并发用户 (1核 + 2GB)
- Enterprise 用户: ~8-12 并发用户 (2核 + 4GB)
```

### 2.2 Docker Compose 配置

创建文件 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    ports:
      - "3001:3001"
    volumes:
      - ./workspace:/app/workspace              # 持久化数据目录（与代码分离）
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DOCKER_HOST=unix:///var/run/docker.sock
      - WORKSPACE_DIR=/app/workspace             # 指定工作目录环境变量
    restart: unless-stopped
    depends_on:
      - db
    networks:
      - claude-network

  db:
    image: postgres:15-alpine
    volumes:
      - ./workspace/database:/var/lib/postgresql/data  # 数据库数据也放在 ./workspace 下
    environment:
      - POSTGRES_DB=claude_code
      - POSTGRES_USER=claude
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped
    networks:
      - claude-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./workspace/ssl:/etc/nginx/ssl:ro       # SSL 证书放在 ./workspace 下
      - ./dist:/usr/share/nginx/html:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - claude-network

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./workspace/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./workspace/prometheus:/prometheus       # Prometheus 数据放在 ./workspace 下
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - claude-network

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./workspace/grafana:/var/lib/grafana    # Grafana 数据放在 ./workspace 下
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    restart: unless-stopped
    networks:
      - claude-network

networks:
  claude-network:
    driver: bridge
```

### 2.3 生产环境配置

创建文件 `production-config.yml`：

```yaml
environment:
  NODE_ENV: production
  PORT: 3001

# 数据库配置
database:
  type: postgresql
  host: localhost
  port: 5432
  name: claude_code
  user: claude
  password: ${DB_PASSWORD}
  ssl: true

# Docker 配置
docker:
  socketPath: /var/run/docker.sock
  apiVersion: 1.43

# 容器配置
containers:
  image: claude-code-runtime:latest
  dataDir: ./workspace                       # 使用项目根目录下的 ./workspace 目录
  logLevel: info

# 资源限制
resources:
  defaultTier: free
  tiers:
    free:
      cpu: 0.5
      memory: 1G
      disk: 5G
    pro:
      cpu: 2
      memory: 4G
      disk: 20G
    enterprise:
      cpu: 4
      memory: 8G
      disk: 50G

# 安全配置
security:
  seccompProfile: /etc/seccomp/claude-code.json
  apparmorProfile: docker-default
  enableNetworkIsolation: true
  allowPrivileged: false

# 监控配置
monitoring:
  enabled: true
  prometheusUrl: http://localhost:9090
  grafanaUrl: http://localhost:3000

# 日志配置
logging:
  level: info
  format: json
  output:
    - type: file
      path: /var/log/claude-code-ui/app.log
    - type: syslog
      facility: local0
```

### 2.4 部署步骤

#### 2.4.1 准备阶段

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. 安装 Docker Compose
sudo apt install docker-compose-plugin -y

# 4. 配置 AppArmor
sudo apt install apparmor apparmor-utils -y

# 5. 创建工作目录
mkdir -p workspace/{users,containers,database,logs,backups}
```

#### 2.4.2 部署应用

```bash
# 1. 克隆代码
git clone <repository-url>
cd ai-claude-code-ui

# 2. 配置环境变量
cp .env.example .env
nano .env

# 3. 构建镜像
docker build -t claude-code-runtime:latest -f Dockerfile.runtime .

# 4. 启动服务
docker-compose up -d

# 5. 检查状态
docker-compose ps
docker-compose logs -f app
```

#### 2.4.3 配置 SSL/TLS

```bash
# 使用 Let's Encrypt 获取免费证书
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com

# 证书会自动配置到 Nginx
```

### 2.5 监控和日志

#### 2.5.1 Prometheus 配置

创建 `workspace/prometheus/prometheus.yml`：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'claude-code'
    static_configs:
      - targets: ['app:3001']
    metrics_path: '/metrics'
```

#### 2.5.2 日志聚合

使用 Loki 进行日志聚合：

```yaml
loki:
  image: grafana/loki:latest
  volumes:
    - ./workspace/loki:/loki
  ports:
    - "3100:3100"
```

### 2.6 备份策略

```bash
#!/bin/bash
# backup.sh - 每日备份脚本

BACKUP_DIR="./workspace/backups/daily"
DATE=$(date +%Y%m%d)

# 备份用户数据
tar -czf "${BACKUP_DIR}/users_${DATE}.tar.gz" ./workspace/users/

# 备份数据库
docker exec db pg_dump -U claude claude_code > "${BACKUP_DIR}/db_${DATE}.sql"

# 清理 7 天前的备份
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +7 -delete
find "${BACKUP_DIR}" -name "*.sql" -mtime +7 -delete
```

### 2.7 运维检查清单

```
每日检查:
□ 检查容器运行状态
□ 检查磁盘使用率
□ 检查错误日志
□ 检查资源使用情况

每周检查:
□ 清理空闲容器
□ 清理孤儿镜像
□ 检查备份完整性
□ 审查安全日志

每月检查:
□ 更新容器镜像
□ 更新系统补丁
□ 审查用户配额
□ 性能优化调整
```

---

## 相关文档

- [架构概述](./architecture-overview.md)
- [数据存储设计](./data-storage-design.md)
- [核心模块设计](./core-modules-design.md)

---

**文档维护**

本文档应该根据实际实施情况持续更新。如有任何疑问或建议，请联系项目维护者。

**版本历史**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-01-10 | Claude | 初始版本 |
