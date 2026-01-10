# 多用户Claude Code系统沙箱隔离方案评估报告

> **文档生成时间**: 2026-01-10
> **评估范围**: 多用户隔离、沙箱技术、安全架构
> **项目版本**: 基于 main 分支 (commit: 97ebef0)

---

## 一、需求概述

### 1.1 核心需求

1. **多用户支持**: 将当前的单用户Claude Code执行系统改造为多用户系统
2. **沙箱隔离**: 使用沙箱技术保护宿主机安全，实现用户间相互隔离
3. **独立实例**: 每个用户使用各自的Claude Code环境

### 1.2 现状分析

根据系统架构分析，当前系统已具备以下多用户基础：

| 组件 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ✅ 已实现 | JWT + bcrypt + SQLite |
| 会话管理 | ✅ 已实现 | 基于sessionId的会话隔离 |
| 数据隔离 | ✅ 已实现 | 用户数据分离存储 |
| 执行隔离 | ❌ 未实现 | node-pty直接在宿主机执行 |
| 文件隔离 | ⚠️ 部分实现 | 仅有路径验证，无强制隔离 |

### 1.3 核心风险点

1. **`server/claude-sdk.js`** - Claude SDK直接访问宿主机文件系统
2. **`server/index.js`** - node-pty创建的shell直接运行在宿主机
3. **`server/index.js`** - 文件操作缺乏强制沙箱边界

---

## 二、沙箱技术方案对比

### 2.1 隔离强度光谱

```
隔离强度光谱：

弱 <──────────────────────────────────────────────> 强
进程级 → 容器级 → MicroVM → 硬件虚拟化
seccomp   Docker   Firecracker   KVM/QEMU
```

### 2.2 详细方案对比

| 方案 | 隔离强度 | 性能开销 | 复杂度 | 成本 | 适用场景 |
|------|----------|----------|--------|------|----------|
| **Docker容器** | 中 | 低 (~5%) | 中 | 低 | 中等安全需求 |
| **Kata Containers** | 高 | 中 (~20%) | 中高 | 中 | 高安全需求 |
| **Firecracker** | 高 | 中 (~15%) | 高 | 低 | 云原生场景 |
| **gVisor** | 中高 | 中 (~30%) | 高 | 低 | 大规模部署 |
| **E2B (托管)** | 高 | N/A | 低 | 高 | 快速上线 |

### 2.3 2025年安全形势

根据最新安全研究，Docker容器在2025年发现多个严重漏洞：

- **CVE-2025-9074** (CVSS 9.3): Docker Desktop容器逃逸漏洞
- **CVE-2025-23266** (NVIDIAScape): NVIDIA Container Toolkit逃逸漏洞
- **runc漏洞**: Docker容器运行时逃逸漏洞

**关键结论**: 单纯的Docker隔离不足以应对高安全需求的多用户场景。

---

## 三、推荐方案详解

### 3.1 方案A: Docker + Seccomp (推荐起步方案)

#### 架构图

```
┌─────────────────────────────────────────────────┐
│              宿主机                              │
│  ┌───────────────────────────────────────────┐  │
│  │         主应用 (Express + React)           │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────▼───────────────────────────┐  │
│  │         Docker Socket Proxy               │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│     ┌────────────┼────────────┐                 │
│     ▼            ▼             ▼                 │
│  ┌─────┐    ┌─────┐       ┌─────┐              │
│  │用户A │    │用户B │       │用户C │              │
│  │容器 │    │容器 │       │容器 │              │
│  └─────┘    └─────┘       └─────┘              │
└─────────────────────────────────────────────────┘
```

#### 优点

- 生态成熟，文档丰富
- 资源开销相对较小
- 部署和维护相对简单
- 支持自定义网络和存储卷

#### 缺点

- 2025年已发现多个容器逃逸漏洞
- 隔离强度相对较弱
- 需要额外的安全加固

#### 实施要点

```javascript
// 关键改造点
1. 为每个用户创建独立容器
2. 使用 Docker volume 挂载用户专属目录
3. 配置 AppArmor/Seccomp 安全策略
4. 容器内运行 node-pty 和 Claude SDK
5. 通过 Docker API 管理容器生命周期
```

---

### 3.2 方案B: Kata Containers (高安全需求推荐)

#### 架构特点

- 使用轻量级VM替代传统容器
- 每个用户获得独立的内核空间
- 支持Docker接口，迁移成本较低

#### 优点

- VM级隔离强度
- 兼容Docker生态
- 防止容器逃逸攻击
- 支持KVM硬件虚拟化

#### 缺点

- 性能开销较大（~20%）
- 需要KVM支持
- 存储和网络配置更复杂

#### 适用场景

- 对安全要求较高的企业环境
- 需要处理不可信代码的场景
- 需要满足合规性要求的场景

---

### 3.3 方案C: Firecracker (云原生场景)

#### 架构特点

- AWS开源的MicroVM技术
- 极简设计，每个VM仅负责一个用户
- 内存开销低（~128MB/VM）

#### 优点

- 高隔离强度
- 启动快（~125ms）
- 资源效率高
- 支持多租户

#### 缺点

- 不支持完整Linux内核功能
- 学习曲线陡峭
- 需要自行管理复杂的编排逻辑

---

### 3.4 方案D: E2B / Replit (快速上线方案)

#### 商业模式

- **E2B**: 专为AI Agent设计的沙箱云服务
- **Replit**: 成熟的代码执行平台

#### 优点

- 零基础设施维护
- 开箱即用的隔离
- 按需付费
- 快速验证MVP

#### 缺点

- 数据隐私考虑
- 长期成本较高
- 依赖第三方服务
- 缺乏定制化能力

---

## 四、分阶段实施路线

### 4.1 阶段规划

```
阶段1: 快速验证 (1-2周)
└── 使用 Docker 基础隔离
    ├── 单机Docker部署
    ├── 每用户独立容器
    └── 基础安全策略

阶段2: 增强安全 (1-2个月)
└── 升级到 Kata Containers
    ├── 保持Docker接口兼容
    ├── VM级隔离
    └── 完整的资源限制

阶段3: 生产优化 (持续)
├── 容器编排 (Kubernetes/Nomad)
├── 监控和审计
└── 自动化扩缩容
```

### 4.2 技术栈建议

```yaml
核心组件:
  容器运行时: Docker (起步) → Kata Containers (生产)
  容器编排: Docker Compose (起步) → Kubernetes (大规模)
  网络: Docker Bridge / CNI
  存储: Docker Volume / CSI

安全加固:
  Seccomp: 系统调用过滤
  AppArmor: 强制访问控制
  Resource Limits: CPU/内存限制
  Network Policies: 容器网络隔离

监控运维:
  容器监控: Prometheus + Grafana
  日志聚合: Loki / ELK
  审计: Falco (容器安全审计)
```

---

## 五、关键实施要点

### 5.1 用户容器管理

```javascript
// 容器生命周期管理伪代码
class UserContainerManager {
  async createUserContainer(userId) {
    const container = await docker.createContainer({
      Image: 'claude-code-runtime:latest',
      Env: [`USER_ID=${userId}`],
      HostConfig: {
        Binds: [`/data/users/${userId}:/workspace`],
        Memory: 2 * 1024 * 1024 * 1024, // 2GB
        CpuQuota: 100000,
        SecurityOpt: [
          'apparmor=docker-default',
          'seccomp=claude-code.json'
        ]
      },
      NetworkMode: `user-${userId}`
    });
    await container.start();
    return container;
  }

  async destroyUserContainer(userId) {
    const container = await this.getContainer(userId);
    await container.stop();
    await container.remove();
  }
}
```

### 5.2 资源限制配置

```javascript
// 资源配额策略
const RESOURCE_LIMITS = {
  free: {
    cpu: '0.5',
    memory: '1G',
    disk: '5G',
    timeout: 300 // 5分钟
  },
  pro: {
    cpu: '2',
    memory: '4G',
    disk: '20G',
    timeout: 3600 // 1小时
  },
  enterprise: {
    cpu: '4',
    memory: '8G',
    disk: '50G',
    timeout: 7200 // 2小时
  }
};
```

### 5.3 安全策略配置

```json
// seccomp 策略示例 (限制危险系统调用)
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    { "name": "read", "action": "SCMP_ACT_ALLOW" },
    { "name": "write", "action": "SCMP_ACT_ALLOW" },
    { "name": "open", "action": "SCMP_ACT_ALLOW" },
    { "name": "close", "action": "SCMP_ACT_ALLOW" },
    { "name": "stat", "action": "SCMP_ACT_ALLOW" },
    { "name": "fstat", "action": "SCMP_ACT_ALLOW" },
    { "name": "mmap", "action": "SCMP_ACT_ALLOW" },
    { "name": "mprotect", "action": "SCMP_ACT_ALLOW" },
    { "name": "munmap", "action": "SCMP_ACT_ALLOW" },
    { "name": "clone", "action": "SCMP_ACT_ALLOW" },
    { "name": "execve", "action": "SCMP_ACT_ALLOW" },
    { "name": "exit", "action": "SCMP_ACT_ALLOW" },
    { "name": "wait4", "action": "SCMP_ACT_ALLOW" },
    { "name": "kill", "action": "SCMP_ACT_ALLOW" },
    { "name": "rt_sigreturn", "action": "SCMP_ACT_ALLOW" },
    { "name": "unshare", "action": "SCMP_ACT_ERRNO" },
    { "name": "mount", "action": "SCMP_ACT_ERRNO" },
    { "name": "pivot_root", "action": "SCMP_ACT_ERRNO" },
    { "name": "ptrace", "action": "SCMP_ACT_ERRNO" },
    { "name": "kexec_load", "action": "SCMP_ACT_ERRNO" },
    { "name": "init_module", "action": "SCMP_ACT_ERRNO" }
  ]
}
```

### 5.4 网络隔离配置

```javascript
// 用户网络隔离
const createNetworkIsolation = async (userId) => {
  // 创建用户专属网络
  await docker.createNetwork({
    Name: `user-${userId}`,
    Driver: 'bridge',
    Internal: true, // 禁止访问外网
    IPAM: {
      Config: [{
        Subnet: `10.${userId % 256}.0.0/24`
      }]
    }
  });
};
```

---

## 六、成本估算

### 6.1 单机部署方案

| 资源 | 规格 | 月成本 |
|------|------|--------|
| 服务器 | 8核32GB | ~$50-100 |
| 存储 | 500GB SSD | ~$20 |
| 带宽 | 5TB | ~$30 |
| **总计** | | **~$100-150/月** |

### 6.2 支持用户数估算

| 使用类型 | 资源配额 | 并发用户数 |
|---------|---------|-----------|
| 轻量使用 | 0.5核 + 1GB | ~30-50用户 |
| 中等使用 | 1核 + 2GB | ~15-25用户 |
| 密集使用 | 2核 + 4GB | ~8-12用户 |

### 6.3 云服务成本对比

| 服务商 | 配置 | 月成本 |
|--------|------|--------|
| AWS EC2 | t3.xlarge (4核16GB) | ~$150 |
| GCP Compute Engine | n2-standard-4 (4核16GB) | ~$140 |
| Azure VM | Standard_D4s_v3 (4核16GB) | ~$160 |
| DigitalOcean | 8核32GB | ~$160 |

---

## 七、风险与挑战

### 7.1 安全风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 容器逃逸漏洞 | 高 | 定期更新、使用Kata Containers |
| 资源滥用 | 中 | 严格的资源限制、配额管理 |
| 恶意代码执行 | 高 | Seccomp、AppArmor策略 |
| 数据持久化 | 中 | 定期备份、卷管理 |
| 网络攻击 | 中 | 网络隔离、防火墙规则 |

### 7.2 技术挑战

| 挑战 | 解决方案 |
|------|----------|
| 容器启动延迟 | 容器预热池 |
| 存储管理 | 自动扩容、定期清理 |
| 网络配置 | CNI插件、网络策略 |
| 监控调试 | 容器日志聚合、监控告警 |

---

## 八、可行性评估

### 8.1 总体评估

**可行性**: ✅ **高度可行**

你的系统已经具备多用户基础架构，主要需要解决**执行环境隔离**问题。

### 8.2 推荐实施路径

```
1. 短期 (1-2周)
   └── Docker基础隔离方案
       ├── 验证多用户架构
       ├── 测试容器性能
       └── 完善安全策略

2. 中期 (1-3个月)
   └── 生产级隔离方案
       ├── 迁移到 Kata Containers
       ├── 完善监控和审计
       └── 自动化运维

3. 长期
   └── 规模化部署
       ├── Kubernetes编排
       ├── 多区域部署
       └── 企业级功能
```

### 8.3 下一步行动

1. **验证测试**: 搭建Docker测试环境，验证容器隔离方案
2. **成本评估**: 根据预期用户量规划基础设施
3. **安全审计**: 制定安全策略和应急响应计划
4. **原型开发**: 开发最小可行原型验证技术方案

---

## 九、参考资料

### 安全研究

- [Docker安全公告](https://docs.docker.com/security/security-announcements/)
- [CVE-2025-9074分析](https://www.rescana.com/post/cve-2025-9074-critical-docker-desktop-container-escape-vulnerability-cvss-9-3-analysis-and-miti)
- [Docker沙箱编码代理](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)
- [Kata Containers Agent沙箱集成](https://katacontainers.io/blog/kata-containers-agent-sandbox-integration/)
- [防御容器逃逸攻击](https://www.appsecengineer.com/blog/defending-kubernetes-clusters-against-container-escape-attacks)

### 技术方案

- [gVisor vs Kata Containers对比](https://stackoverflow.com/questions/50143367/kata-containers-vs-gvisor)
- [虚拟化-容器-沙箱对比](https://forums.whonix.org/t/the-great-virtualization-container-sandbox-race/22243)
- [WebAssembly SaaS安全层](https://medium.com/@hashbyt/webassembly-the-mandatory-plugin-security-layer-for-saas-in-2025-187b2b4e53ba)
- [WASM vs Hyper VMs对比](https://thenewstack.io/webassembly-hyper-vms-and-hypervisors-fast-speeds-intense-isolation/)

### 商业方案

- [顶级AI代码执行沙箱平台](https://www.koyeb.com/blog/top-sandbox-code-execution-platforms-for-ai-code-execution-2025)
- [E2B企业AI代理云](https://e2b.dev/)
- [E2B Firecracker vs QEMU](https://e2b.dev/blog/firecracker-vs-qemu)
- [Replit AI代理代码执行API](https://blog.replit.com/ai-agents-code-execution)
- [安全沙箱代码执行精选](https://github.com/restyler/awesome-sandbox)

---

## 十、总结

### 核心建议

1. **分阶段实施**: 从Docker基础方案开始，逐步增强安全性
2. **安全优先**: 使用Kata Containers等VM级隔离技术
3. **资源管理**: 严格的资源限制和配额管理
4. **监控审计**: 完善的监控、日志和审计系统
5. **持续改进**: 定期更新、安全扫描和性能优化

### 预期效果

- **用户隔离**: 每个用户拥有独立的执行环境
- **安全保护**: 宿主机和其他用户不受影响
- **资源可控**: CPU、内存、磁盘等资源可限制
- **可扩展**: 支持横向扩展和负载均衡
- **可监控**: 完善的监控和审计能力

---

**文档维护**: 请根据实际实施情况更新本文档
**联系支持**: 如有技术问题，请提交Issue或联系项目维护者
