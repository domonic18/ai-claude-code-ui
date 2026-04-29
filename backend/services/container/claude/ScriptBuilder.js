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
  'Task', 'TodoWrite', 'TodoRead', 'WebFetch', 'WebSearch', 'Skill',
  'AskUserQuestion'
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
 * bypassPermissions 模式下注入自主执行系统提示词
 *
 * 告诉 AI 不要提问、不要等待确认、自动继续执行所有任务。
 * 使用 SDK 的 systemPrompt.append 机制，在默认 claude_code 提示词后追加指令。
 *
 * @param {object} sdkOptions - SDK 选项（可变）
 */
function injectAutonomousSystemPrompt(sdkOptions) {
  sdkOptions.systemPrompt = {
    type: 'preset',
    preset: 'claude_code',
    append: [
      '## 自主执行模式（AUTONOMOUS MODE）',
      '当前处于无限制自主执行模式，你必须严格遵守以下规则：',
      '1. **禁止提问用户**：不要输出任何需要用户回复的问题，包括但不限于"是否继续？"、"需要我继续吗？"、"请确认"等表述。',
      '2. **禁止等待确认**：不要在任何阶段暂停等待用户确认，直接执行下一步。',
      '3. **完整执行所有任务**：遇到需要分步骤执行的长任务时，自动依次完成所有步骤，不要因为"进度汇报"而中断执行。绝对不要在中间阶段停下来汇报进度后就结束——必须继续执行剩余阶段。',
      '4. **禁止使用 AskUserQuestion 工具**：不要调用 AskUserQuestion 向用户提问。',
      '5. **遇到问题自行决策**：遇到歧义或选择时，基于上下文自行做出最合理的判断并继续执行，不要停下来询问用户。',
      '6. **持续执行直到全部完成**：只有当所有任务都真正完成后才输出最终结果。如果任务分为多个阶段（如阶段1到阶段N），你必须完成所有阶段，不能在中间某个阶段结束后就停止。',
      '7. **禁止输出"断点续传"或"可从中断处继续"的提示**：这意味着你还有未完成的工作，应该继续执行而不是停下来告诉用户可以恢复。',
    ].join('\n'),
  };
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

  // bypassPermissions 模式下注入自主执行指令，防止 AI 中途停下来提问
  if (sdkOptions.permissionMode === 'bypassPermissions') {
    injectAutonomousSystemPrompt(sdkOptions);
    logger.info('[ScriptBuilder] Injected autonomous system prompt (bypassPermissions mode)');
  }

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

  logger.info({
    model: sdkOptions.model,
    permissionMode: sdkOptions.permissionMode,
    allowDangerouslySkipPermissions: sdkOptions.allowDangerouslySkipPermissions,
    optionsSize: JSON.stringify(sdkOptions).length,
  }, '[ScriptBuilder] SDK options summary');



  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  const BASE64_SAFE = /^[A-Za-z0-9+/=]+$/;
  if (!BASE64_SAFE.test(commandBase64)) throw new Error('commandBase64 contains non-standard base64 characters');
  if (!BASE64_SAFE.test(optionsBase64)) throw new Error('optionsBase64 contains non-standard base64 characters');

  const tmpId = randomUUID();
  const tmpOptionsFile = `/tmp/sdk_opts_${tmpId}.b64`;
  const tmpScriptFile = `/tmp/sdk_exec_${tmpId}.mjs`;

  const scriptContent = generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths, sdkOptions.permissionMode);

  return { scriptContent, optionsBase64, tmpOptionsFile, tmpScriptFile };
}
