/**
 * sdkOptionCleaner.js
 *
 * SDK 选项清理逻辑
 * Extracted from ScriptBuilder to reduce complexity
 *
 * @module container/claude/helpers/sdkOptionCleaner
 */

import { getInteractivePlanningTools } from './permissionModeHelper.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('container/claude/sdkOptionCleaner');

/** 需要从 SDK 选项中移除的内部字段 */
const INTERNAL_FIELDS_TO_REMOVE = [
  'userId',
  'isContainerProject',
  'projectPath',
  'toolsSettings',
  'images',
  'imagePaths'
];

/**
 * 移除不需要传给 SDK 的内部字段
 * @param {object} sdkOptions
 */
function removeInternalFields(sdkOptions) {
  for (const field of INTERNAL_FIELDS_TO_REMOVE) {
    delete sdkOptions[field];
  }
}

/**
 * UUID v4 正则（用于验证 sessionId 格式）
 * CLI 的 --session-id 必须为有效的 UUID，否则报错退出
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 处理 resume 和 sessionId 参数
 *
 * 容器模式：永不 resume（每次从头开始）。
 * SDK 对 resume 选项会传 --resume <sessionId> 给 CLI，
 * CLI 尝试恢复已完成的会话状态并崩溃，exit code 1。
 *
 * sessionId 仅当为有效 UUID 时才传给 SDK（CLI --session-id 要求 UUID 格式），
 * temp-xxx 等非 UUID 标识不传递，由 SDK 自动生成会话 ID。
 *
 * @param {object} sdkOptions
 * @param {object} options
 */
function handleResumeParam(sdkOptions, options) {
  // 容器模式：永不 resume，避免 CLI 恢复已完成会话崩溃
  delete sdkOptions.resume;

  // sessionId 仅传有效 UUID（CLI 校验 UUID 格式，非 UUID 直接退出码 1）
  // 前端首次发送 temp-xxx 等临时 ID，不传给 CLI
  if (options.sessionId && UUID_V4_REGEX.test(options.sessionId)) {
    sdkOptions.sessionId = options.sessionId;
  } else {
    // 非 UUID 格式必须删除（sdkOptions 从 options 浅拷贝而来，自带 sessionId）
    delete sdkOptions.sessionId;
  }
}

/**
 * 合并禁止工具列表（系统级 + 用户级）
 * @param {object} sdkOptions
 * @param {string[]} userDisallowedTools
 */
function mergeDisallowedTools(sdkOptions, userDisallowedTools) {
  const interactivePlanningTools = getInteractivePlanningTools();
  sdkOptions.disallowedTools = [...userDisallowedTools, ...interactivePlanningTools];
  logger.debug({ interactivePlanningTools }, 'Disallowed interactive planning tools');
  if (userDisallowedTools.length > 0) {
    logger.debug({ userDisallowedTools }, 'User disallowed tools');
  }
}

/**
 * 清理 SDK 选项中的内部字段和参数
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项
 * @param {string[]} userDisallowedTools - 用户级禁止工具列表
 */
export function cleanupSdkOptions(sdkOptions, options, userDisallowedTools) {
  removeInternalFields(sdkOptions);
  handleResumeParam(sdkOptions, options);
  mergeDisallowedTools(sdkOptions, userDisallowedTools);

  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }

  logger.debug({ keys: Object.keys(sdkOptions) }, 'Returning sdkOptions keys');
}
