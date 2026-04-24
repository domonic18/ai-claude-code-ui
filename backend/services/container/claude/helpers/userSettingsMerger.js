/**
 * userSettingsMerger.js
 *
 * 合并用户设置到 SDK 选项的辅助逻辑
 * Extracted from ScriptBuilder to reduce complexity
 *
 * @module container/claude/helpers/userSettingsMerger
 */

import { UserSettingsService } from '../../../settings/UserSettingsService.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('container/claude/userSettingsMerger');

/**
 * 从用户设置中应用单个字段到 sdkOptions
 * @param {object} sdkOptions - SDK 选项
 * @param {object} settings - 前端传入的 toolsSettings
 * @param {object} userSettings - 数据库用户设置
 * @param {string} settingsKey - settings 中的键名
 * @param {string} userSettingsKey - userSettings 中的键名
 * @param {string} sdkKey - sdkOptions 中的键名
 */
function applySettingIfMissing(sdkOptions, settings, userSettings, settingsKey, userSettingsKey, sdkKey) {
  if (!settings[settingsKey] && userSettings[userSettingsKey]?.length > 0) {
    sdkOptions[sdkKey] = userSettings[userSettingsKey];
    logger.debug({ [sdkKey]: userSettings[userSettingsKey] }, `Using user settings for ${sdkKey}`);
  }
}

/**
 * 合并用户设置到 SDK 选项
 * 优先级：前端传入 > 数据库用户设置 > 默认值
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 前端传入的 toolsSettings
 * @param {number} userId - 用户 ID
 */
export async function mergeUserSettings(sdkOptions, settings, userId) {
  let userSettings = null;
  try {
    userSettings = await UserSettingsService.getSettings(userId, 'claude');
    logger.debug({ userId }, 'Loaded user settings for user');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to load user settings, using defaults');
    return;
  }

  if (!userSettings) return;

  applySettingIfMissing(sdkOptions, settings, userSettings, 'allowedTools', 'allowed_tools', 'allowedTools');
  applySettingIfMissing(sdkOptions, settings, userSettings, 'disallowedTools', 'disallowed_tools', 'disallowedTools');

  // skipPermissions: 使用 != null 同时排除 null 和 undefined
  if (settings.skipPermissions == null && userSettings.skip_permissions != null) {
    settings.skipPermissions = userSettings.skip_permissions;
    logger.debug({ skipPermissions: userSettings.skip_permissions }, 'Using user settings for skipPermissions');
  }
}
