/**
 * SDK 性能诊断模块
 *
 * 解析容器内 [SDK_PERF] 时间戳标记并输出阶段 cost，以及 partial delta 到达节奏摘要。
 * 从 dockerStreamHandler.js 抽离，使后者聚焦于流处理编排（单一职责）。
 *
 * @module services/container/claude/sdkPerfDiagnostics
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/container/claude/sdkPerfDiagnostics');

/**
 * 解析容器内 [SDK_PERF] 时间戳标记，配对后输出阶段 cost。
 * 容器内所有标记同源时钟（Date.now()），故 delta 不受宿主/容器时钟偏移影响。
 * 此前这些标记喷到 stderr 后被丢弃，是网关/模型延迟不可见的主因。
 *
 * perf 为调用方传入的对象，在单个 stream 的生命周期内累积（每次 setupStderrHandler
 * 调用新建一个，天然按流/会话隔离，不存在跨会话共享）。
 *
 * @param {Object} perf - 累积的 perf 时间戳对象（按 marker 名）
 * @param {string} line - stderr 单行
 * @param {string} sessionId - 会话 ID
 */
export function recordSdkPerf(perf, line, sessionId) {
  const m = line.match(/^\[SDK_PERF\]\s*(\w+):(\d+)\s*$/);
  if (!m) return;
  const [, name, tsStr] = m;
  perf[name] = parseInt(tsStr, 10);
  if (name === 'api_call_start' && perf.script_start != null) {
    logger.info({ sessionId, cost: perf.api_call_start - perf.script_start, phase: 'sdk_init' }, '[SDK_PERF] Container SDK init (script_start → api_call_start)');
  } else if (name === 'first_chunk' && perf.api_call_start != null) {
    logger.info({ sessionId, cost: perf.first_chunk - perf.api_call_start, phase: 'model_first_event' }, '[SDK_PERF] Model first event (api_call_start → first_chunk)');
  } else if (name === 'first_delta' && perf.api_call_start != null) {
    logger.info({ sessionId, cost: perf.first_delta - perf.api_call_start, phase: 'text_ttft' }, '[SDK_PERF] Text TTFT (api_call_start → first_delta)');
  }
}

/**
 * 输出 partial delta 到达节奏摘要，判定网关是否真流式透传 SSE：
 * - span 大（秒级）、meanGap/p90 为几十~几百 ms 且无明显聚集 → 网关真流式 ✅
 * - span 极小（<500ms）或 maxGap≈span（一个大间隔后集中涌出）→ 网关缓冲 ❌
 * deltas 用宿主时钟记录（衡量 delta 到达后端的节奏）。
 *
 * 由 stream context 的 beforeSettle 钩子调用——settle 是所有终止路径（正常/超时/错误/abort）
 * 的唯一出口，故 delta 数据在任何终止情况下都会被记录。
 *
 * @param {number[]} deltas - delta 到达时间戳数组
 * @param {string} sessionId - 会话 ID
 * @param {number} textCount - text delta 计数
 * @param {number} thinkingCount - thinking delta 计数
 */
export function emitDeltaCadence(deltas, sessionId, textCount = 0, thinkingCount = 0) {
  if (!Array.isArray(deltas) || deltas.length === 0) {
    // 即使没有 text/thinking 增量（如纯工具调用会话），也记录计数便于排查
    if (textCount || thinkingCount) {
      logger.info({ sessionId, deltaCount: 0, textDeltaCount: textCount, thinkingDeltaCount: thinkingCount }, '[SDK_PERF] Partial delta cadence (no timed deltas)');
    }
    return;
  }
  const n = deltas.length;
  const span = deltas[n - 1] - deltas[0];
  if (n === 1) {
    logger.info({ sessionId, cost: 0, deltaCount: 1, textDeltaCount: textCount, thinkingDeltaCount: thinkingCount }, '[SDK_PERF] Partial delta cadence (single delta)');
    return;
  }
  const gaps = [];
  for (let i = 1; i < n; i++) gaps.push(deltas[i] - deltas[i - 1]);
  gaps.sort((a, b) => a - b);
  const meanGap = Math.round(span / (n - 1));
  const p90Gap = gaps[Math.floor(gaps.length * 0.9)];
  logger.info(
    { sessionId, cost: span, deltaCount: n, textDeltaCount: textCount, thinkingDeltaCount: thinkingCount, meanGap, p90Gap, maxGap: gaps[gaps.length - 1] },
    '[SDK_PERF] Partial delta cadence (span=cost)'
  );
}
