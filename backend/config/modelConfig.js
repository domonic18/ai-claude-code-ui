/**
 * AI 模型配置模块
 *
 * 从 AVAILABLE_MODELS 环境变量解析可用模型列表。
 * 格式：模型名:提供商|模型名:提供商
 * 示例：AVAILABLE_MODELS=glm-4.7:Zhipu GLM|glm-5:Zhipu GLM|kimi-k2.5:Moonshot AI
 *
 * @module config/modelConfig
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('config/modelConfig');

/**
 * AI 模型配置
 */
export const MODELS = {
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
