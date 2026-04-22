/**
 * OptionsMapper.js
 *
 * CLI 选项到 SDK 选项的映射器
 * 处理 Claude SDK 选项的转换和验证
 *
 * @module execution/claude/OptionsMapper
 */

import { CLAUDE_MODELS } from '../../../../shared/modelConstants.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/claude/OptionsMapper');

// 由 mapCliOptionsToSDK 调用，从环境变量读取自定义 Anthropic API 配置
/**
 * 获取自定义 API 配置
 * @returns {Object} 自定义 API 配置
 */
function getCustomApiConfig() {
  return {
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    model: process.env.ANTHROPIC_MODEL
  };
}

// 由 buildToolPermissions 调用，返回 Claude SDK 默认启用的工具列表
/**
 * 构建默认工具列表
 * @returns {Array<string>} 默认工具列表
 */
function getDefaultTools() {
  return [
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
    'Skill'           // 关键：启用 Skill 工具，否则 SDK 不会加载 Skills
  ];
}

// 由 mapCliOptionsToSDK 调用，根据权限模式构建工具允许/拒绝列表
/**
 * 构建工具权限配置
 * @param {Object} settings - 工具设置
 * @param {string} permissionMode - 权限模式
 * @returns {Object} 工具权限配置
 */
function buildToolPermissions(settings, permissionMode) {
  const defaultTools = getDefaultTools();

  // 处理工具权限
  if (settings.skipPermissions && permissionMode !== 'plan') {
    return { permissionMode: 'bypassPermissions' };
  }

  let allowedTools = (settings.allowedTools && settings.allowedTools.length > 0)
    ? [...settings.allowedTools]
    : [...defaultTools];

  // 添加计划模式默认工具
  if (permissionMode === 'plan') {
    const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite', 'WebFetch', 'WebSearch'];
    for (const tool of planModeTools) {
      if (!allowedTools.includes(tool)) {
        allowedTools.push(tool);
      }
    }
  }

  const result = {};

  if (allowedTools.length > 0) {
    result.allowedTools = allowedTools;
  }

  if (settings.disallowedTools && settings.disallowedTools.length > 0) {
    result.disallowedTools = settings.disallowedTools;
  }

  return result;
}

// 由 mapCliOptionsToSDK 调用，将环境变量中的自定义 API 配置应用到 SDK 选项
/**
 * 应用自定义 API 配置
 * @param {Object} sdkOptions - SDK 选项对象
 * @param {Object} options - 原始选项
 * @returns {Object} 更新后的 SDK 选项
 */
function applyCustomApiConfig(sdkOptions, options) {
  const customConfig = getCustomApiConfig();

  // 映射模型
  if (customConfig.model) {
    sdkOptions.model = customConfig.model;
    logger.info(`Using custom model from environment: ${sdkOptions.model}`);
  } else {
    sdkOptions.model = options.model || CLAUDE_MODELS.DEFAULT;
    logger.info(`Using model: ${sdkOptions.model}`);
  }

  // 如果指定了自定义 API 基础 URL
  if (customConfig.baseURL) {
    sdkOptions.baseURL = customConfig.baseURL;
    logger.info(`Using custom API endpoint: ${customConfig.baseURL}`);
  }

  // 如果指定了自定义 API 密钥
  if (customConfig.apiKey) {
    sdkOptions.apiKey = customConfig.apiKey;
    logger.info(`Using custom API key from environment`);
  }

  return sdkOptions;
}

// 由 Claude 执行器调用，将前端传入的选项转换为 Claude SDK 所需格式
/**
 * 将 CLI 选项映射为 SDK 兼容的选项格式
 * @param {Object} options - CLI 选项
 * @returns {Object} SDK 兼容的选项
 */
export function mapCliOptionsToSDK(options = {}) {
  const { sessionId, cwd, toolsSettings, permissionMode, images } = options;

  const settings = toolsSettings || {
    allowedTools: [],
    disallowedTools: [],
    skipPermissions: false
  };

  const sdkOptions = {};

  // 映射工作目录
  if (cwd) {
    sdkOptions.cwd = cwd;
  }

  // 映射权限模式
  if (permissionMode && permissionMode !== 'default') {
    sdkOptions.permissionMode = permissionMode;
  }

  // 映射工具权限
  const toolPermissions = buildToolPermissions(settings, permissionMode);
  Object.assign(sdkOptions, toolPermissions);

  // 应用自定义 API 配置
  applyCustomApiConfig(sdkOptions, options);

  // 映射系统提示配置
  sdkOptions.systemPrompt = {
    type: 'preset',
    preset: 'claude_code'
  };

  // 映射 CLAUDE.md 加载的设置源
  sdkOptions.settingSources = ['project', 'user', 'local'];

  // 映射恢复会话
  if (sessionId) {
    sdkOptions.resume = sessionId;
  }

  return sdkOptions;
}

// 由 Claude 执行器调用，验证必需的 SDK 选项是否完整
/**
 * 验证 SDK 选项
 * @param {Object} options - SDK 选项
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateSdkOptions(options = {}) {
  const errors = [];

  // 验证模型
  if (!options.model) {
    errors.push('model is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  mapCliOptionsToSDK,
  validateSdkOptions
};
