/**
 * Message Budget Helpers
 *
 * Helper functions for extracting token budget information and error detection from SDK messages
 *
 * @module services/container/claude/messageBudgetHelpers
 */

/**
 * Extracts token budget information from SDK message
 * @param {Object} sdkMessage - SDK message object
 * @returns {Object|null} Token budget info with used and total
 */
export function extractTokenBudget(sdkMessage) {
  if (sdkMessage.type !== 'result' || !sdkMessage.modelUsage) return null;

  const modelData = Object.values(sdkMessage.modelUsage)[0];
  if (!modelData) return null;

  const totalUsed =
    (modelData.inputTokens ?? modelData.cumulativeInputTokens ?? 0) +
    (modelData.outputTokens ?? modelData.cumulativeOutputTokens ?? 0) +
    (modelData.cacheReadInputTokens ?? modelData.cumulativeCacheReadInputTokens ?? 0) +
    (modelData.cacheCreationInputTokens ?? modelData.cumulativeCacheCreationInputTokens ?? 0);

  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

  return { used: totalUsed, total: contextWindow };
}

/**
 * Checks if SDK result indicates an error
 * @param {Object} sdkMessage - SDK message object
 * @returns {boolean} True if result indicates error
 */
export function isResultError(sdkMessage) {
  const result = sdkMessage.result;
  return result && /^(Unknown skill|Error:|Failed:)/i.test(result);
}
