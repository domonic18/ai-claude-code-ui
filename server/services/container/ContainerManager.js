/**
 * 容器管理器 - 向后兼容入口
 *
 * 此文件已重构为模块化架构。
 * 所有功能已移至 server/services/container/core/ 目录。
 *
 * 此文件保留作为向后兼容的入口，所有导出从 core 模块重导出。
 *
 * 重构后的模块结构：
 * - core/DockerConnection.js - Docker 连接管理
 * - core/ContainerConfig.js - 容器配置构建
 * - core/ContainerHealth.js - 健康检查和监控
 * - core/ContainerStats.js - 资源统计
 * - core/ContainerCleanup.js - 清理策略
 * - core/ContainerLifecycle.js - 生命周期管理
 * - core/index.js - 统一导出和单例管理
 *
 * @deprecated 请直接从 core/index.js 导入
 */

// 从核心模块重导出所有内容
export { default, ContainerManager } from './core/index.js';

// 同时导出所有子模块供高级使用
export * from './core/index.js';
