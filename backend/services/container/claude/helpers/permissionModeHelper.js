/**
 * Permission Mode Helper
 *
 * Helper functions for determining SDK permission mode.
 *
 * 容器环境的关键约束：
 * 1. 用户容器以 root 运行，CLI 拒绝在 root 下使用 --dangerously-skip-permissions
 * 2. 容器没有终端，'default' 模式下无法处理交互式权限确认
 * 3. 'dontAsk' 模式下 Bash 等工具被 CLI 严格限制，即使匹配 allowedTools 也会被拒
 *
 * 解决方案：不传 --permission-mode，依赖 SDK 的 --permission-prompt-tool stdio 机制。
 * SDK 检测到 canUseTool 回调后会自动添加 --permission-prompt-tool stdio，
 * CLI 通过 stdin/stdout 协议将权限请求发回给我们的 canUseTool 回调，
 * 回调对所有工具（除 AskUserQuestion 有特殊处理外）返回 allow。
 *
 * @module container/claude/helpers/permissionModeHelper
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('container/claude/permissionModeHelper');

/**
 * 系统级禁用的交互式规划工具
 * 注意：AskUserQuestion 已启用，支持 Agent 向用户提问并等待回答
 */
const INTERACTIVE_PLANNING_TOOLS = [
  'EnterPlanMode',   // 进入规划模式
  'ExitPlanMode'     // 退出规划模式
];

/**
 * 确定权限模式
 *
 * 容器模式下不传 permissionMode（删除该字段），让 SDK 使用
 * --permission-prompt-tool stdio 机制，通过 canUseTool 回调处理所有权限请求。
 *
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 合并后的 toolsSettings
 * @returns {string[]} 用户级禁止工具列表（不含系统级）
 */
export function determinePermissionMode(sdkOptions, settings) {
  // 提取用户设置的禁止工具（排除系统级的 interactivePlanningTools）
  const userDisallowedTools = sdkOptions.disallowedTools
    ? sdkOptions.disallowedTools.filter(tool => !INTERACTIVE_PLANNING_TOOLS.includes(tool))
    : [];

  // 容器环境：删除 permissionMode，不传 --permission-mode 给 CLI
  // SDK 检测到 canUseTool 回调后会自动添加 --permission-prompt-tool stdio，
  // CLI 通过 stdin/stdout 协议请求权限，我们的 canUseTool 回调返回 allow
  delete sdkOptions.permissionMode;

  if (userDisallowedTools.length > 0) {
    logger.warn(
      { disallowedTools: userDisallowedTools },
      'Container mode: canUseTool callback will handle permissions with user disallowedTools'
    );
  }
  logger.debug('Clearing permissionMode: using canUseTool callback via --permission-prompt-tool stdio');

  return userDisallowedTools;
}

/**
 * 获取系统级禁用的交互式规划工具列表
 * @returns {string[]} 系统级禁用工具列表
 */
export function getInteractivePlanningTools() {
  return [...INTERACTIVE_PLANNING_TOOLS];
}
