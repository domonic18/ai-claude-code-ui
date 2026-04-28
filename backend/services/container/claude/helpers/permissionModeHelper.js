/**
 * Permission Mode Helper
 *
 * Helper functions for determining SDK permission mode
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
 * 优先级：前端传入的 permissionMode > skipPermissions > 默认 bypass
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 合并后的 toolsSettings
 * @returns {string[]} 用户级禁止工具列表（不含系统级）
 */
export function determinePermissionMode(sdkOptions, settings) {
  // 提取用户设置的禁止工具（排除系统级的 interactivePlanningTools）
  const userDisallowedTools = sdkOptions.disallowedTools
    ? sdkOptions.disallowedTools.filter(tool => !INTERACTIVE_PLANNING_TOOLS.includes(tool))
    : [];
  const hasUserDisallowedTools = userDisallowedTools.length > 0;
  const usingDefaultTools = !sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0;

  if (sdkOptions.permissionMode) {
    // 前端明确传入了 permissionMode
    if (sdkOptions.permissionMode === 'bypassPermissions' && hasUserDisallowedTools) {
      logger.warn({ disallowedTools: userDisallowedTools }, 'WARNING: bypassPermissions mode will disable user-set disallowedTools');
    }
    logger.debug({ permissionMode: sdkOptions.permissionMode }, 'Using frontend permissionMode');
  } else if (settings.skipPermissions && !hasUserDisallowedTools) {
    // 用户设置 skipPermissions 且没有用户禁止工具
    sdkOptions.permissionMode = 'bypassPermissions';
    logger.debug('Setting permissionMode: bypassPermissions (reason: skipPermissions=true, no user disallowedTools)');
  } else if (usingDefaultTools && !hasUserDisallowedTools) {
    // 使用默认工具列表且没有用户禁止工具
    sdkOptions.permissionMode = 'bypassPermissions';
    logger.debug('Setting permissionMode: bypassPermissions (reason: using default tools, no user disallowedTools)');
  } else {
    sdkOptions.permissionMode = 'default';
    logger.debug({ reason: hasUserDisallowedTools ? 'has user disallowedTools' : 'default fallback' }, 'Setting permissionMode: default');
  }

  // Claude Agent SDK 要求：使用 bypassPermissions 模式时必须同时设置 allowDangerouslySkipPermissions
  // 参考：@anthropic-ai/claude-agent-sdk sdk.d.ts:789-792
  if (sdkOptions.permissionMode === 'bypassPermissions') {
    sdkOptions.allowDangerouslySkipPermissions = true;
  }

  return userDisallowedTools;
}

/**
 * 获取系统级禁用的交互式规划工具列表
 * @returns {string[]} 系统级禁用工具列表
 */
export function getInteractivePlanningTools() {
  return [...INTERACTIVE_PLANNING_TOOLS];
}
