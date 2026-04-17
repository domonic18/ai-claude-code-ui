/**
 * MessageAggregator.js
 *
 * 消息聚合器类 — 提供消息统计和按日期聚合功能
 *
 * @module core/utils/message-filter/MessageAggregator
 */

/**
 * 消息聚合器类
 */
export class MessageAggregator {
  /**
   * 计算消息统计
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Object} 统计信息
   */
  static aggregateStats(messages) {
    const stats = {
      totalCount: messages.length,
      byRole: {},
      byType: {},
      tokenUsage: {
        input: 0,
        cacheCreation: 0,
        cacheRead: 0,
        output: 0,
        total: 0,
      },
      timeRange: {
        first: null,
        last: null,
      },
    };

    for (const message of messages) {
      _accumulateByRole(stats.byRole, message.role);
      _accumulateByType(stats.byType, message.type);
      _accumulateTokenUsage(stats.tokenUsage, message.usage);
      _updateTimeRange(stats.timeRange, message.timestamp);
    }

    stats.tokenUsage.total =
      stats.tokenUsage.input +
      stats.tokenUsage.cacheCreation +
      stats.tokenUsage.cacheRead +
      stats.tokenUsage.output;

    return stats;
  }

  /**
   * 按日期聚合消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Map<string, number>} 按日期聚合的消息数量
   */
  static aggregateByDate(messages) {
    const aggregation = new Map();

    for (const message of messages) {
      if (!message.timestamp) continue;

      const date = new Date(message.timestamp);
      const dateKey = date.toISOString().split('T')[0];

      aggregation.set(dateKey, (aggregation.get(dateKey) || 0) + 1);
    }

    return aggregation;
  }
}

/**
 * 按角色累加计数
 * @param {Object} byRole - 角色统计对象
 * @param {string} [role] - 角色
 */
function _accumulateByRole(byRole, role) {
  if (role) {
    byRole[role] = (byRole[role] || 0) + 1;
  }
}

/**
 * 按类型累加计数
 * @param {Object} byType - 类型统计对象
 * @param {string} [type] - 类型
 */
function _accumulateByType(byType, type) {
  if (type) {
    byType[type] = (byType[type] || 0) + 1;
  }
}

/**
 * 累加 Token 使用量
 * @param {Object} tokenUsage - Token 使用统计对象
 * @param {Object} [usage] - 消息的 usage 对象
 */
function _accumulateTokenUsage(tokenUsage, usage) {
  if (!usage) return;

  tokenUsage.input += usage.input_tokens || 0;
  tokenUsage.cacheCreation += usage.cache_creation_input_tokens || 0;
  tokenUsage.cacheRead += usage.cache_read_input_tokens || 0;
  tokenUsage.output += usage.output_tokens || 0;
}

/**
 * 更新时间范围
 * @param {Object} timeRange - 时间范围对象
 * @param {string} [timestamp] - 时间戳
 */
function _updateTimeRange(timeRange, timestamp) {
  if (!timestamp) return;

  const ts = new Date(timestamp);
  if (!timeRange.first || ts < timeRange.first) {
    timeRange.first = ts;
  }
  if (!timeRange.last || ts > timeRange.last) {
    timeRange.last = ts;
  }
}
