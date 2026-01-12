/**
 * OptionsMapper.js
 *
 * CLI 选项到 SDK 选项的映射器
 * 处理 Claude SDK 选项的转换和验证
 *
 * @module execution/claude/OptionsMapper
 */

import { CLAUDE_MODELS } from '../../../../shared/modelConstants.js';

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

/**
 * 将 CLI 选项映射为 SDK 兼容的选项格式
 * @param {Object} options - CLI 选项
 * @returns {Object} SDK 兼容的选项
 */
export function mapCliOptionsToSDK(options = {}) {
  const { sessionId, cwd, toolsSettings, permissionMode, images } = options;

  const sdkOptions = {};

  // 映射工作目录
  if (cwd) {
    sdkOptions.cwd = cwd;
  }

  // 映射权限模式
  if (permissionMode && permissionMode !== 'default') {
    sdkOptions.permissionMode = permissionMode;
  }

  // 映射工具设置
  const settings = toolsSettings || {
    allowedTools: [],
    disallowedTools: [],
    skipPermissions: false
  };

  // 处理工具权限
  if (settings.skipPermissions && permissionMode !== 'plan') {
    sdkOptions.permissionMode = 'bypassPermissions';
  } else {
    let allowedTools = [...(settings.allowedTools || [])];

    // 添加计划模式默认工具
    if (permissionMode === 'plan') {
      const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite', 'WebFetch', 'WebSearch'];
      for (const tool of planModeTools) {
        if (!allowedTools.includes(tool)) {
          allowedTools.push(tool);
        }
      }
    }

    if (allowedTools.length > 0) {
      sdkOptions.allowedTools = allowedTools;
    }

    if (settings.disallowedTools && settings.disallowedTools.length > 0) {
      sdkOptions.disallowedTools = settings.disallowedTools;
    }
  }

  // 应用环境变量中的自定义 API 配置
  const customConfig = getCustomApiConfig();

  // 映射模型
  if (customConfig.model) {
    sdkOptions.model = customConfig.model;
    console.log(`Using custom model from environment: ${sdkOptions.model}`);
  } else {
    sdkOptions.model = options.model || CLAUDE_MODELS.DEFAULT;
    console.log(`Using model: ${sdkOptions.model}`);
  }

  // 如果指定了自定义 API 基础 URL
  if (customConfig.baseURL) {
    sdkOptions.baseURL = customConfig.baseURL;
    console.log(`Using custom API endpoint: ${customConfig.baseURL}`);
  }

  // 如果指定了自定义 API 密钥
  if (customConfig.apiKey) {
    sdkOptions.apiKey = customConfig.apiKey;
    console.log(`Using custom API key from environment`);
  }

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
