/**
 * Token 使用统计器
 * 用于计算 JSONL 文件中的 Token 使用情况
 *
 * @module core/utils/jsonl/TokenUsageCalculator
 */

const DEFAULT_TOKEN_LIMIT = 200000;

/**
 * Token 使用统计器类
 */
export class TokenUsageCalculator {
  /**
   * 计算条目的 Token 使用量
   * @param {Object} entry - JSONL 条目
   * @returns {Object} Token 使用统计
   */
  static calculateEntryTokens(entry) {
    if (!entry.usage) {
      return { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, total: 0 };
    }

    const usage = entry.usage;
    const input = usage.input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const output = usage.output_tokens || 0;

    return {
      input,
      cacheCreation,
      cacheRead,
      output,
      total: input + cacheCreation + cacheRead + output,
    };
  }

  /**
   * 计算 JSONL 内容的总 Token 使用量
   * @param {string} content - JSONL 文件内容
   * @param {Function} parseFn - 解析函数 (JsonlParser.parse)
   * @returns {Object} Token 使用统计
   */
  static calculateTotalTokens(content, parseFn) {
    const { entries } = parseFn(content);
    let totalTokens = 0;
    let inputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;

    for (const entry of entries) {
      const tokens = this.calculateEntryTokens(entry);
      inputTokens += tokens.input;
      cacheCreationTokens += tokens.cacheCreation;
      cacheReadTokens += tokens.cacheRead;
      totalTokens += tokens.output;
    }

    totalTokens += inputTokens + cacheCreationTokens + cacheReadTokens;

    return {
      used: totalTokens,
      total: DEFAULT_TOKEN_LIMIT,
      breakdown: { input: inputTokens, cacheCreation: cacheCreationTokens, cacheRead: cacheReadTokens },
    };
  }
}
