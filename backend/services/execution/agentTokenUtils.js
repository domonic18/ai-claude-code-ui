/**
 * Agent Token Utilities
 *
 * Utility functions for token calculation and message filtering.
 *
 * @module services/execution/agentTokenUtils
 */

/**
 * Get assistant messages from collected messages
 *
 * @param {Array<Object>} messages - All messages
 * @returns {Array<Object>} Filtered assistant messages
 */
export function getAssistantMessages(messages) {
  const result = [];
  for (const msg of messages) {
    if (msg && msg.type === 'status') continue;

    if (typeof msg === 'string') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'claude-response' && parsed.data && parsed.data.type === 'assistant') {
          result.push(parsed.data);
        }
      } catch { /* skip */ }
    }
  }
  return result;
}

/**
 * Calculate total token usage from all messages
 *
 * @param {Array<Object>} messages - All messages
 * @returns {{inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheCreationTokens: number, totalTokens: number}}
 */
export function getTotalTokens(messages) {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  for (const msg of messages) {
    let data = msg;
    if (typeof msg === 'string') {
      try { data = JSON.parse(msg); } catch { continue; }
    }

    if (data && data.type === 'claude-response' && data.data) {
      const usage = data.data.message?.usage;
      if (usage) {
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
        cacheReadTokens += usage.cache_read_input_tokens || 0;
        cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      }
    }
  }

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens
  };
}
