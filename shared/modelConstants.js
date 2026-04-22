/**
 * Centralized Model Definitions
 *
 * Claude SDK Models:
 * - 用于后端 SDK 集成和默认模型选择
 * - 主要使用在 OptionsMapper.js、agent.js 等后端服务中
 * - 这些是向后兼容的常量，主要用于 Cursor 和 Codex 集成
 *
 * 前端模型选择:
 * - 前端通过 GET /api/models 端点获取可用模型列表
 * - 模型列表从 AVAILABLE_MODELS 环境变量解析
 * - 格式：model:provider|model:provider
 *
 * @module shared/modelConstants
 */

/**
 * Claude (Anthropic) Models
 * 注意：这些常量用于后端 SDK 集成和默认模型选择
 */
export const CLAUDE_MODELS = {
  OPTIONS: [
    { value: 'custom', label: 'Custom (from ANTHROPIC_MODEL env var)' }
  ],
  DEFAULT: 'custom'
};

/**
 * Cursor Models
 * 注意：这些常量用于 Cursor CLI 集成
 */
export const CURSOR_MODELS = {
  OPTIONS: [
    { value: 'gpt-5.2-high', label: 'GPT-5.2 High' },
    { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    { value: 'opus-4.5-thinking', label: 'Claude 4.5 Opus (Thinking)' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.1', label: 'GPT-5.1' },
    { value: 'gpt-5.1-high', label: 'GPT-5.1 High' },
    { value: 'composer-1', label: 'Composer 1' },
    { value: 'auto', label: 'Auto' },
    { value: 'sonnet-4.5', label: 'Claude 4.5 Sonnet' },
    { value: 'sonnet-4.5-thinking', label: 'Claude 4.5 Sonnet (Thinking)' },
    { value: 'opus-4.5', label: 'Claude 4.5 Opus' },
    { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
    { value: 'gpt-5.1-codex-high', label: 'GPT-5.1 Codex High' },
    { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
    { value: 'gpt-5.1-codex-max-high', label: 'GPT-5.1 Codex Max High' },
    { value: 'opus-4.1', label: 'Claude 4.1 Opus' },
    { value: 'grok', label: 'Grok' }
  ],
  DEFAULT: 'gpt-5'
};

/**
 * Codex (OpenAI) Models
 * 注意：这些常量用于 OpenAI Codex 集成
 */
export const CODEX_MODELS = {
  OPTIONS: [
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
    { value: 'o3', label: 'O3' },
    { value: 'o4-mini', label: 'O4-mini' }
  ],
  DEFAULT: 'gpt-5.2'
};

// 由模型选择器组件调用，从后端 API 获取可用模型列表
/**
 * 获取模型选项的异步函数（前端专用）
 * 从后端 API 获取可用模型列表
 *
 * @returns {Promise<Array>} 模型选项数组
 * @throws {Error} 如果获取失败
 */
export async function getAllModelOptions() {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch models (${response.status}): ${errorText}`);
    }
    const data = await response.json();

    // 确保返回的是数组，如果 API 返回格式错误则抛出明确错误
    if (!Array.isArray(data.models)) {
      throw new Error('Invalid API response: models field is missing or not an array');
    }

    return data.models;
  } catch (error) {
    console.error('[modelConstants] Error fetching models:', error);
    // 直接重新抛出原始错误，保留完整的错误信息和堆栈
    throw error;
  }
}
