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

// 保留现有路由（待迁移）
export { default as cliAuth } from './cli-auth.js';
export { default as codex } from './codex.js';
export { default as cursor } from './cursor.js';
export { default as git } from './git.js';
export { default as mcp } from './mcp.js';
export { default as mcpUtils } from './mcp-utils.js';
export { default as system } from './system.js';
export { default as uploads } from './uploads.js';
export { default as user } from './user.js';
export { default as taskmaster } from './taskmaster.js';

// agent 路由（复杂，待后续重构）
export { default as agent } from './agent.js';

// commands 路由（自定义命令功能，与 tools/commands 不同）
export { default as customCommands } from './commands.js';
