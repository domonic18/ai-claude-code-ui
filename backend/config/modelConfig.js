/**
 * AI 模型配置模块
 *
 * 从 AVAILABLE_MODELS 环境变量解析可用模型列表。
 * 格式：模型名:提供商|模型名:提供商
 * 示例：AVAILABLE_MODELS=glm-4.7:Zhipu GLM|glm-5:Zhipu GLM|kimi-k2.5:Moonshot AI
 *
 * 支持多 provider 端点配置：
 *   默认 provider 使用 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN
 *   其他 provider 通过 PROVIDER_<KEY>_BASE_URL / PROVIDER_<KEY>_API_KEY 配置
 *   其中 <KEY> 是 provider 名称的大写下划线格式（如 OpenRouter → OPENROUTER）
 *
 * @module config/modelConfig
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('config/modelConfig');

/**
 * 将 provider 显示名称转换为环境变量 KEY 后缀
 *
 * 例如："OpenRouter" → "OPENROUTER"，"Zhipu GLM" → "ZHIPU_GLM"
 *
 * @param {string} provider - Provider 显示名称
 * @returns {string} 环境变量 KEY 后缀（大写下划线格式）
 */
function providerToEnvKey(provider) {
  return provider.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

/**
 * 解析 provider 注册表 —— 从环境变量中构建 provider → endpoint 的映射
 *
 * 环境变量命名规则：
 *   PROVIDER_<KEY>_BASE_URL   — API 端点 URL
 *   PROVIDER_<KEY>_API_KEY    — API 密钥
 *   PROVIDER_<KEY>_AUTH_TOKEN — 认证 token（可选，默认等于 API_KEY）
 *
 * 默认 provider 使用 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY
 *
 * @param {Array<{name: string, provider: string}>} models - 已解析的模型列表
 * @returns {Map<string, {baseURL: string, authToken: string, apiKey: string, provider: string, needsProxy: boolean}>} provider 配置映射
 */
function buildProviderRegistry(models) {
  const registry = new Map();

  // 收集所有唯一的 provider 名称
  const providerNames = [...new Set(models.map(m => m.provider))];

  for (const provider of providerNames) {
    const envKey = providerToEnvKey(provider);

    // 查找 provider 专属环境变量
    const providerBaseURL = process.env[`PROVIDER_${envKey}_BASE_URL`];
    const providerApiKey = process.env[`PROVIDER_${envKey}_API_KEY`];
    const providerAuthToken = process.env[`PROVIDER_${envKey}_AUTH_TOKEN`] || providerApiKey;

    // 检查该 provider 是否需要代理（通过 PROVIDER_<KEY>_NEEDS_PROXY 环境变量）
    const needsProxy = process.env[`PROVIDER_${envKey}_NEEDS_PROXY`] === 'true';

    if (providerBaseURL && providerAuthToken) {
      // 有专属配置的 provider
      registry.set(provider, {
        baseURL: providerBaseURL,
        authToken: providerAuthToken,
        apiKey: providerApiKey || '',
        provider,
        needsProxy,
      });
      logger.info(`[MODELS] Provider "${provider}" → custom endpoint: ${providerBaseURL}, needsProxy: ${needsProxy}`);
    } else {
      // 使用默认 ANTHROPIC 端点
      const defaultBaseURL = process.env.ANTHROPIC_BASE_URL;
      const defaultAuthToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
      if (!defaultBaseURL || !defaultAuthToken) {
        logger.warn(`[MODELS] Provider "${provider}" has no custom endpoint and default ANTHROPIC_BASE_URL/AUTH_TOKEN is not set`);
      }
      registry.set(provider, {
        baseURL: defaultBaseURL || '',
        authToken: defaultAuthToken || '',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        provider,
        needsProxy,
      });
      logger.info(`[MODELS] Provider "${provider}" → default endpoint: ${defaultBaseURL || '( Anthropic default )'}, needsProxy: ${needsProxy}`);
    }
  }

  return registry;
}

/**
 * AI 模型配置
 */
export const MODELS = {
// 配置相关函数，在应用启动时调用
  /**
   * 解析并验证 AVAILABLE_MODELS 环境变量
   * @returns {Array<{name: string, provider: string}>} 模型数组
   * @throws {Error} 如果环境变量无效
   */
  available: (() => {
    if (!process.env.AVAILABLE_MODELS) {
      throw new Error(
        'AVAILABLE_MODELS environment variable is required.\n' +
        'Format: model:provider|model:provider\n' +
        'Example: AVAILABLE_MODELS=glm-4.7:Zhipu GLM|glm-5:Zhipu GLM|kimi-k2.5:Moonshot AI'
      );
    }

    try {
      const entries = process.env.AVAILABLE_MODELS.split('|');

      const models = entries.map((entry, index) => {
        const parts = entry.split(':');
        if (parts.length < 2) {
          throw new Error(
            `Invalid model entry at index ${index}: "${entry}".\n` +
            'Expected format: model:provider\n' +
            `Example: glm-4.7:Zhipu GLM`
          );
        }

        const name = parts[0].trim();
        const provider = parts.slice(1).join(':').trim(); // Provider 可能包含空格，使用 join(':') 处理

        if (!name || !provider) {
          throw new Error(
            `Model name or provider cannot be empty at index ${index}: "${entry}"`
          );
        }

        return { name, provider, description: '' };
      });

      if (models.length === 0) {
        throw new Error('AVAILABLE_MODELS must contain at least one model');
      }

      logger.info(`[MODELS] Loaded ${models.length} models from AVAILABLE_MODELS`);
      return models;
    } catch (error) {
      if (error.message.startsWith('AVAILABLE_MODELS') ||
          error.message.startsWith('Invalid model entry')) {
        throw error; // 重新抛出我们自己的验证错误
      }
      throw new Error(
        `Failed to parse AVAILABLE_MODELS: ${error.message}\n` +
        `Format: model:provider|model:provider\n` +
        `Example: AVAILABLE_MODELS=glm-4.7:Zhipu GLM|glm-5:Zhipu GLM|kimi-k2.5:Moonshot AI`
      );
    }
  })(),

  /**
   * 默认模型（使用第一个可用模型）
   */
  default: (() => {
    try {
      return MODELS.available[0]?.name;
    } catch {
      return undefined; // 如果解析失败，返回 undefined 让调用者知道有问题
    }
  })(),

  /**
   * API 配置（保留用于向后兼容）
   * 注意：SDK 现在使用前端传入的 model 参数，不再依赖这些环境变量
   */
  api: {
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};

/**
 * Provider 注册表 —— provider 名称 → {baseURL, authToken, apiKey, provider, needsProxy} 映射
 *
 * 在模块加载时从环境变量构建，运行时只读
 * @type {Map<string, {baseURL: string, authToken: string, apiKey: string, provider: string, needsProxy: boolean}>}
 */
const providerRegistry = buildProviderRegistry(MODELS.available);

/**
 * 根据模型名称获取对应的 provider 端点配置
 *
 * 查找逻辑：
 * 1. 从 AVAILABLE_MODELS 中找到该模型的 provider
 * 2. 从 providerRegistry 中查找该 provider 的端点配置
 * 3. 如果找不到，回退到默认 ANTHROPIC 端点
 *
 * @param {string} modelName - 模型名称（如 "glm-4.7" 或 "anthropic/claude-sonnet-4"）
 * @returns {{baseURL: string, authToken: string, apiKey: string, provider: string, needsProxy: boolean}} provider 端点配置
 */
export function getModelProviderConfig(modelName) {
  // 从模型列表中查找该模型的 provider
  const modelEntry = MODELS.available.find(m => m.name === modelName);

  if (modelEntry) {
    const config = providerRegistry.get(modelEntry.provider);
    if (config) {
      return config;
    }
  }

  // 回退到默认 ANTHROPIC 配置
  const fallback = {
    baseURL: process.env.ANTHROPIC_BASE_URL || '',
    authToken: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    provider: 'default',
    needsProxy: false,
  };
  logger.warn({ modelName }, '[MODELS] No provider config found, using default ANTHROPIC endpoint');
  return fallback;
}

