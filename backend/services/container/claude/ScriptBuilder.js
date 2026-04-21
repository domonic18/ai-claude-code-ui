/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 * @module container/claude/ScriptBuilder
 */

import { loadAgentsForSDK } from '../../../services/extensions/extension-sync.js';
import { randomUUID } from 'crypto';
import { createLogger } from '../../../utils/logger.js';
import { generateSDKScript } from './templates/sdkScriptTemplate.js';
import { determinePermissionMode } from './helpers/permissionModeHelper.js';
import { mergeUserSettings } from './helpers/userSettingsMerger.js';
import { cleanupSdkOptions } from './helpers/sdkOptionCleaner.js';

const logger = createLogger('container/claude/ScriptBuilder');

/** 默认允许的工具列表 */
const DEFAULT_ALLOWED_TOOLS = [
  'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(git status:*)',
  'Bash(pdftotext:*)', 'Bash(pandoc:*)', 'Bash(file:*)',
  'Write', 'Read', 'Edit', 'Glob', 'Grep', 'MultiEdit',
  'Task', 'TodoWrite', 'TodoRead', 'WebFetch', 'WebSearch', 'Skill'
];

/**
 * 设置默认工具列表
 * @param {object} sdkOptions
 */
function setDefaultTools(sdkOptions) {
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [...DEFAULT_ALLOWED_TOOLS];
  }
}

/**
 * 应用前端 toolsSettings 覆盖到 sdkOptions
 * @param {object} sdkOptions
 * @param {object} settings
 */
function applyFrontendOverrides(sdkOptions, settings) {
  if (settings.allowedTools?.length > 0) sdkOptions.allowedTools = settings.allowedTools;
  if (settings.disallowedTools?.length > 0) sdkOptions.disallowedTools = settings.disallowedTools;
}

/**
 * 配置扩展加载（agents 和 plugins）
 * @param {object} sdkOptions
 * @param {object} options
 */
async function configureExtensions(sdkOptions, options) {
  sdkOptions.settingSources = ['user', 'project'];

  if (options.enableExtensions === false) return;

  try {
    sdkOptions.agents = await loadAgentsForSDK();
    sdkOptions.plugins = [{ type: 'local', path: '/workspace/.claude' }];
  } catch (error) {
    logger.error({ error }, 'Failed to load extensions');
    sdkOptions.agents = {};
    sdkOptions.plugins = [];
  }
}

/**
 * 过滤 SDK 选项
 * @param {object} options
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function filterSDKOptions(options, userId) {
  const sdkOptions = { ...options };
  const settings = options.toolsSettings || {};

  await mergeUserSettings(sdkOptions, settings, userId);
  applyFrontendOverrides(sdkOptions, settings);
  setDefaultTools(sdkOptions);
  await configureExtensions(sdkOptions, options);

  const userDisallowedTools = determinePermissionMode(sdkOptions, settings);
  cleanupSdkOptions(sdkOptions, options, userDisallowedTools);

  return sdkOptions;
}

/**
 * 生成 SDK 执行脚本
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>}
 */
export async function buildSDKScript(command, options, userId) {
  const sessionId = options.sessionId || '';
  const imagePaths = options.imagePaths || [];

  const sdkOptions = await filterSDKOptions(options, userId);

  logger.debug({ model: sdkOptions.model }, 'sdkOptions.model');
  logger.debug({ size: JSON.stringify(sdkOptions).length }, 'optionsJson size');

  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  const BASE64_SAFE = /^[A-Za-z0-9+/=]+$/;
  if (!BASE64_SAFE.test(commandBase64)) throw new Error('commandBase64 contains non-standard base64 characters');
  if (!BASE64_SAFE.test(optionsBase64)) throw new Error('optionsBase64 contains non-standard base64 characters');

  const tmpId = randomUUID();
  const tmpOptionsFile = `/tmp/sdk_opts_${tmpId}.b64`;
  const tmpScriptFile = `/tmp/sdk_exec_${tmpId}.mjs`;

  const scriptContent = generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths);

  return { scriptContent, optionsBase64, tmpOptionsFile, tmpScriptFile };
}
