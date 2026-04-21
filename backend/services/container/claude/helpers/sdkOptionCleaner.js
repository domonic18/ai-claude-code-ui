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
 * 处理 resume 和 sessionId 参数
 * @param {object} sdkOptions
 * @param {object} options
 */
function handleResumeParam(sdkOptions, options) {
  if (options.sessionId && options.resume === true) {
    sdkOptions.resume = options.sessionId;
  } else {
    delete sdkOptions.resume;
  }
  delete sdkOptions.sessionId;
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
