/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 * @module container/claude/ScriptBuilder
 */

import { UserSettingsService } from '../../settings/UserSettingsService.js';
import { loadAgentsForSDK } from '../../../services/extensions/extension-sync.js';
import { randomUUID } from 'crypto';
import { createLogger } from '../../../utils/logger.js';
import { generateSDKScript } from './templates/sdkScriptTemplate.js';
import { determinePermissionMode, getInteractivePlanningTools } from './helpers/permissionModeHelper.js';

const logger = createLogger('container/claude/ScriptBuilder');

/** 默认允许的工具列表 */
const DEFAULT_ALLOWED_TOOLS = [
  // Git 相关命令
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  // 文档处理命令（PDF、Word 等）
  'Bash(pdftotext:*)',
  'Bash(pandoc:*)',
  'Bash(file:*)',
  // 其他工具
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch',
  'Skill'           // 关键修复：启用 Skill 工具，否则 SDK 不会加载 Skills
];

/** 需要从 SDK 选项中移除的内部字段 */
const INTERNAL_FIELDS_TO_REMOVE = [
  'userId',
  'isContainerProject',
  'projectPath',
  'toolsSettings',
  'images',       // 图片数据在 DockerExecutor 中处理
  'imagePaths'    // 图片路径在脚本中单独处理
];

/**
 * 合并用户设置到 SDK 选项
 * 优先级：前端传入 > 数据库用户设置 > 默认值
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 前端传入的 toolsSettings
 * @param {number} userId - 用户 ID
 */
async function mergeUserSettings(sdkOptions, settings, userId) {
  let userSettings = null;
  try {
    userSettings = await UserSettingsService.getSettings(userId, 'claude');
    logger.debug({ userId }, 'Loaded user settings for user');
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to load user settings, using defaults');
  }

  if (!userSettings) {
    return;
  }

  // allowedTools: 只有在前端没有传入时才使用用户设置
  if (!settings.allowedTools && userSettings.allowed_tools?.length > 0) {
    sdkOptions.allowedTools = userSettings.allowed_tools;
    logger.debug({ allowedTools: userSettings.allowed_tools }, 'Using user settings for allowedTools');
  }
  // disallowedTools: 只有在前端没有传入时才使用用户设置
  if (!settings.disallowedTools && userSettings.disallowed_tools?.length > 0) {
    sdkOptions.disallowedTools = userSettings.disallowed_tools;
    logger.debug({ disallowedTools: userSettings.disallowed_tools }, 'Using user settings for disallowedTools');
  }
  // skipPermissions: 使用 != null 同时排除 null 和 undefined，明确处理 false 值
  if (settings.skipPermissions == null && userSettings.skip_permissions != null) {
    settings.skipPermissions = userSettings.skip_permissions;
    logger.debug({ skipPermissions: userSettings.skip_permissions }, 'Using user settings for skipPermissions');
  }
}

/**
 * 设置默认工具列表（当没有配置任何工具时）
 * @param {object} sdkOptions - SDK 选项（可变）
 */
function setDefaultTools(sdkOptions) {
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [...DEFAULT_ALLOWED_TOOLS];
    logger.debug('Setting default allowedTools');
  }
}

/**
 * 配置扩展加载（agents 和 plugins）
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项
 */
async function configureExtensions(sdkOptions, options) {
  // 关键修复：设置 settingSources 以从文件系统加载扩展
  // SDK 将自动从 settings.json / CLAUDE.md / skills/ / agents/ 等位置加载
  sdkOptions.settingSources = ['user', 'project'];
  logger.debug('Setting settingSources: user, project');

  if (options.enableExtensions === false) {
    return;
  }

  try {
    // 动态加载 agents（从 .md 文件读取）
    sdkOptions.agents = await loadAgentsForSDK();
    logger.debug({ agents: Object.keys(sdkOptions.agents) }, 'Loaded agents');

    // 配置 plugins 指向 skills 目录，SDK 会自动扫描
    sdkOptions.plugins = [{ type: 'local', path: '/workspace/.claude' }];
    logger.debug('Configured plugins for skills scanning');
  } catch (error) {
    logger.error({ error }, 'Failed to load extensions');
    sdkOptions.agents = {};
    sdkOptions.plugins = [];
  }
}

/**
 * 清理 SDK 选项中的内部字段和参数
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项
 * @param {string[]} userDisallowedTools - 用户级禁止工具列表
 */
function cleanupSdkOptions(sdkOptions, options, userDisallowedTools) {
  // 移除不需要传给 SDK 的内部字段
  for (const field of INTERNAL_FIELDS_TO_REMOVE) {
    delete sdkOptions[field];
  }

  // 处理 resume 参数：有 sessionId 且 resume 为 true 时才保留
  if (options.sessionId && options.resume === true) {
    sdkOptions.resume = options.sessionId;
  } else {
    delete sdkOptions.resume;
  }

  // 合并系统级和用户级的 disallowedTools
  const interactivePlanningTools = getInteractivePlanningTools();
  sdkOptions.disallowedTools = [...userDisallowedTools, ...interactivePlanningTools];
  logger.debug({ interactivePlanningTools }, 'Disallowed interactive planning tools');
  if (userDisallowedTools.length > 0) {
    logger.debug({ userDisallowedTools }, 'User disallowed tools');
  }

  // 移除 sessionId（SDK 不需要这个参数）
  delete sdkOptions.sessionId;

  // 处理 model 参数：如果是 "custom"，则由环境变量决定
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }

  logger.debug({ keys: Object.keys(sdkOptions) }, 'Returning sdkOptions keys');
}

/**
 * 过滤 SDK 选项，移除不需要传给 SDK 的字段
 * @param {object} options - 原始选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>} 过滤后的选项
 */
async function filterSDKOptions(options, userId) {
  const sdkOptions = { ...options };
  const settings = options.toolsSettings || {};

  // 步骤 1：合并用户设置到 SDK 选项
  await mergeUserSettings(sdkOptions, settings, userId);

  // 步骤 2：从 toolsSettings 提取最终配置覆盖
  if (settings.allowedTools?.length > 0) {
    sdkOptions.allowedTools = settings.allowedTools;
  }
  if (settings.disallowedTools?.length > 0) {
    sdkOptions.disallowedTools = settings.disallowedTools;
  }

  // 步骤 3：设置默认工具
  setDefaultTools(sdkOptions);

  // 步骤 4：配置扩展加载
  await configureExtensions(sdkOptions, options);

  // 步骤 5：确定权限模式
  const userDisallowedTools = determinePermissionMode(sdkOptions, settings);

  // 步骤 6：清理内部字段和参数
  cleanupSdkOptions(sdkOptions, options, userDisallowedTools);

  return sdkOptions;
}

/**
 * 生成 SDK 执行脚本
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>} 包含脚本内容、base64 数据和临时文件路径的对象
 */
export async function buildSDKScript(command, options, userId) {
  // 提取 sessionId 以便在脚本中使用
  const sessionId = options.sessionId || '';

  // 提取图片路径（已由 DockerExecutor 复制到容器内）
  const imagePaths = options.imagePaths || [];
  logger.debug({ imagePaths }, 'Image paths received');

  // 过滤并处理 options（现在是异步的）
  const sdkOptions = await filterSDKOptions(options, userId);

  // 调试：打印 options 摘要
  logger.debug({ model: sdkOptions.model }, 'Original sdkOptions.model');
  const optionsJsonLength = JSON.stringify(sdkOptions).length;
  logger.debug({ size: optionsJsonLength }, 'optionsJson size');

  // 使用 base64 编码来避免转义问题
  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  // 安全断言：base64 标准字符集不包含模板字符串特殊字符（" $ `），防止注入
  const BASE64_SAFE = /^[A-Za-z0-9+/=]+$/;
  if (!BASE64_SAFE.test(commandBase64)) {
    throw new Error('commandBase64 contains non-standard base64 characters');
  }
  if (!BASE64_SAFE.test(optionsBase64)) {
    throw new Error('optionsBase64 contains non-standard base64 characters');
  }

  // 生成唯一的临时文件名，使用 crypto.randomUUID() 保证唯一性和不可预测性
  const tmpId = randomUUID();
  const tmpOptionsFile = `/tmp/sdk_opts_${tmpId}.b64`;
  const tmpScriptFile = `/tmp/sdk_exec_${tmpId}.mjs`;

  // 使用模板生成脚本内容
  const scriptContent = generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths);

  // 返回执行所需的信息：脚本内容、options base64 数据、临时文件路径
  // DockerExecutor 负责将文件写入容器并执行
  return {
    scriptContent,
    optionsBase64,
    tmpOptionsFile,
    tmpScriptFile
  };
}
