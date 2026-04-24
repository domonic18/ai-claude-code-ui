/**
 * Permission Mode Helper
 *
 * Helper functions for determining SDK permission mode.
 *
 * 容器环境的权限策略变更（2026-04-24）：
 *
 * 旧方案：删除 permissionMode，依赖 canUseTool 回调处理所有权限请求。
 *   SDK 检测到 canUseTool 后添加 --permission-prompt-tool stdio，
 *   但 SDK 的 ZQ 类会在 permissionMode 未提供时默认填入 "default"，
 *   导致 CLI 收到 --permission-mode default，对 Bash 等工具有内置限制，
 *   即使 canUseTool 返回 allow，CLI 仍拒绝执行 Bash。
 *
 * 新方案：
 *   容器内 SDK script 以 user: 'node'（非 root）运行，
 *   CLI 接受 --dangerously-skip-permissions / bypassPermissions。
 *   设置 permissionMode: 'bypassPermissions' + allowDangerouslySkipPermissions: true。
 *   注意：SDK 不将该字段传递到 CLI，而是内部使用；
 *   实际透传给 CLI 的参数由 addSDKSpecificOptions 等路径决定。
 *   保留 canUseTool 回调用于 AskUserQuestion 交互。
 *
 * 约束前提：
 *   1. 不再以 root 运行容器 exec，改用 node 用户
 *   2. CLI 在非 root 下接受 --dangerously-skip-permissions
 *   3. node 用户对 /workspace/my-workspace/ 有读写权限（容器 entrypoint 已设置）
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
 * 使用 bypassPermissions 绕过所有工具权限检查。
 * non-root 用户（node）下 CLI 接受此设置。
 * 保留 canUseTool 回调用于 AskUserQuestion 交互。
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

  // 使用 bypassPermissions 模式，绕过 CLI 对 Bash 等工具的内置限制
  // SDK script 以 node 用户（非 root）运行，CLI 接受此设置
  sdkOptions.permissionMode = 'bypassPermissions';
  sdkOptions.allowDangerouslySkipPermissions = true;

  if (userDisallowedTools.length > 0) {
    logger.warn(
      { disallowedTools: userDisallowedTools },
      'Container mode: bypassPermissions with user disallowedTools'
    );
  }
  logger.debug('Using bypassPermissions mode (non-root user, CLI accepts --dangerously-skip-permissions)');

  return userDisallowedTools;
}

/**
 * 获取系统级禁用的交互式规划工具列表
 * @returns {string[]} 系统级禁用工具列表
 */
export function getInteractivePlanningTools() {
  return [...INTERACTIVE_PLANNING_TOOLS];
}
