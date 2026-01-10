# 多用户 Claude Code 系统 - 架构设计文档导航

> **文档版本**: 2.0
> **创建时间**: 2026-01-10
> **方案类型**: Docker + Seccomp 容器隔离
> **项目版本**: 基于 main 分支

---

## 📋 文档说明

本架构设计文档已拆分为多个独立文件，便于查阅和维护。

---

## 🗂️ 文档结构

### 1. [架构概述](./architecture-overview.md)

**内容概要**：
- 架构设计目标与技术选型
- 整体架构设计与分层说明
- 实施计划与里程碑
- 参考资源与术语表

**适合人群**：所有读者

---

### 2. [数据存储设计](./data-storage-design.md)

**内容概要**：
- 存储架构概览
- Docker Volume 设计
- 数据库设计与表结构
- 容器数据持久化策略
- 备份与恢复流程

**适合人群**：后端开发、运维工程师

---

### 3. [核心模块设计](./core-modules-design.md)

**内容概要**：
- 核心实现流程（认证、执行、终端、文件操作）
- 容器管理器 (ContainerManager) 详细设计
- 容器镜像设计 (Dockerfile)
- WebSocket 连接管理
- 文件操作容器化

**适合人群**：后端开发、全栈开发

---

### 4. [安全与部署配置](./security-deployment-config.md)

**内容概要**：
- Seccomp 策略配置
- AppArmor 配置
- 网络隔离配置
- 资源限制配置
- 部署架构与步骤
- 监控与日志配置

**适合人群**：运维工程师、安全工程师

---

## 🚀 快速导航

| 需求 | 推荐文档 |
|------|---------|
| 了解整体架构 | [架构概述](./architecture-overview.md) |
| 设计数据库 | [数据存储设计](./data-storage-design.md) |
| 开发容器功能 | [核心模块设计](./core-modules-design.md) |
| 部署到生产 | [安全与部署配置](./security-deployment-config.md) |
| 配置安全策略 | [安全与部署配置](./security-deployment-config.md#一安全策略配置) |
| 了解数据备份 | [数据存储设计](./data-storage-design.md#四容器数据持久化策略) |

---

## 📚 相关文档

- [多用户沙箱隔离方案评估报告](./multi-user-sandbox-evaluation.md)
- [项目结构说明](../ai-context/project-structure.md)
- [API 文档](../api/README.md)

---

## 📖 阅读建议

### 新手入门

1. 先阅读 [架构概述](./architecture-overview.md) 了解整体设计
2. 再阅读 [核心模块设计](./core-modules-design.md) 了解实现细节
3. 最后阅读 [安全与部署配置](./security-deployment-config.md) 了解部署流程

### 开发人员

1. 重点阅读 [核心模块设计](./core-modules-design.md)
2. 参考 [数据存储设计](./data-storage-design.md) 设计数据库
3. 了解 [安全与部署配置](./security-deployment-config.md) 中的安全要求

### 运维人员

1. 重点阅读 [安全与部署配置](./security-deployment-config.md)
2. 了解 [数据存储设计](./data-storage-design.md) 中的备份策略
3. 参考 [架构概述](./architecture-overview.md) 了解系统架构

---

## 📝 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 2.0 | 2026-01-10 | Claude | 拆分为多个独立文档，添加导航索引 |
| 1.0 | 2026-01-10 | Claude | 初始版本 |

---

## 🔗 外部链接

- [Docker 官方文档](https://docs.docker.com/)
- [Node.js 文档](https://nodejs.org/docs)
- [Seccomp 文档](https://docs.docker.com/engine/security/seccomp/)
- [AppArmor 文档](https://gitlab.com/apparmor/apparmor/-/wikis/home)

---

**文档维护**

本文档作为导航索引，各子文档由相应模块维护者负责更新。

如有任何疑问或建议，请联系项目维护者。
