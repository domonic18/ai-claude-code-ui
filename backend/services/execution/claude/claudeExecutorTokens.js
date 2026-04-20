/**
 * Claude Executor Token Utilities
 *
 * Token budget extraction and calculation utilities
 *
 * @module execution/claude/claudeExecutorTokens
 */

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/claude/claudeExecutorTokens');

/**
 * Extracts token budget from SDK result message
 * @param {Object} resultMessage - SDK result message
 * @returns {Object|null} Token budget with used and total
 */
export function extractTokenBudget(resultMessage) {
  if (resultMessage.type !== 'result' || !resultMessage.modelUsage) {
    return null;
  }

  const modelKey = Object.keys(resultMessage.modelUsage)[0];
  const modelData = resultMessage.modelUsage[modelKey];

  if (!modelData) {
    return null;
  }

  const inputTokens = modelData.cumulativeInputTokens || modelData.inputTokens || 0;
  const outputTokens = modelData.cumulativeOutputTokens || modelData.outputTokens || 0;
  const cacheReadTokens = modelData.cumulativeCacheReadInputTokens || modelData.cacheReadInputTokens || 0;
  const cacheCreationTokens = modelData.cumulativeCacheCreationInputTokens || modelData.cacheCreationInputTokens || 0;

  const totalUsed = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

  logger.debug({ inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, totalUsed, contextWindow }, '[ClaudeExecutor] Token calculation');

  return {
    used: totalUsed,
    total: contextWindow
  };
}
