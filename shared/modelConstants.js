/**
 * Centralized Model Definitions
 *
 * 单一数据源原则：所有模型配置通过后端 API 获取
 * 前端通过 GET /api/models 端点获取可用模型列表
 *
 * @module shared/modelConstants
 */

/**
 * Claude (Anthropic) Models
 * 注意：这些常量用于后端 SDK 集成
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

/**
 * 默认模型列表（用于前端 API 调用失败时的回退）
 */
const DEFAULT_MODELS_FALLBACK = [
  { name: 'glm-4.7', provider: 'Zhipu GLM', description: 'Latest flagship model' },
  { name: 'glm-5', provider: 'Zhipu GLM', description: 'Next generation model' },
  { name: 'kimi-k2.5', provider: 'Kimi', description: 'Moonshot AI Kimi model' }
];

/**
 * 获取模型选项的异步函数（前端专用）
 * 从后端 API 获取可用模型列表
 *
 * @returns {Promise<Array>} 模型选项数组
 */
export async function getAllModelOptions() {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || DEFAULT_MODELS_FALLBACK;
  } catch (error) {
    console.error('[modelConstants] Error fetching models:', error);
    // 返回默认模型作为回退
    return DEFAULT_MODELS_FALLBACK;
  }
}

/**
 * 默认模型名称
 * 如果 API 调用失败，使用此默认值
 */
export const DEFAULT_MODEL = 'glm-4.7';

/**
 * 获取默认模型的同步函数
 * 用于初始化，实际模型列表通过异步 API 获取
 *
 * @returns {string} 默认模型名称
 */
export function getDefaultModel() {
  return DEFAULT_MODEL;
}
