/**
 * routes/index.js
 *
 * 路由统一导出和挂载
 *
 * 按功能分组的路由结构：
 * - core: 核心认证和设置路由
 * - resources: 项目、会话、文件等资源路由
 * - integrations: Claude 等 AI 集成路由
 * - tools: 命令行工具路由
 */

// 核心路由
export * from './core/index.js';

// 资源路由
export * from './resources/index.js';

// 集成路由
export * from './integrations/index.js';

// 工具路由
export * from './tools/index.js';

// 保留 CLI 认证路由（特殊用途）
export { default as cliAuth } from './cli-auth.js';

// 保留自定义命令路由（与 tools/commands 不同）
export { default as customCommands } from './commands.js';
