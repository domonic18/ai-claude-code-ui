/**
 * Stage Status Inference
 *
 * 从消息流末尾推断当前流式阶段，供状态行展示：
 * - tool-running：最近的工具调用尚无结果 →「正在执行：Bash...」
 * - thinking：存在未封段的思考块 →「深度思考中...」
 * - analyzing：其余空窗（prefill/推理/等待 API）→ 文案随持续时间升级
 * - responding：正文 delta 正在到达 → 交给现有 StreamingIndicator
 *
 * 纯函数：对同一消息数组结果恒定。
 *
 * @module chat/utils/stageStatus
 */

import type { ChatMessage } from '../types';

/** 推断出的流式阶段 */
export type StreamStage = 'responding' | 'tool-running' | 'thinking' | 'analyzing';

/** 分析中状态的持续时间升级阈值（毫秒） */
export const ANALYZING_ESCALATE_MS = 15_000;
export const ANALYZING_LONG_WAIT_MS = 60_000;

/**
 * 推断当前流式阶段
 *
 * 从消息末尾反向找最近一条有阶段意义的消息（跳过任务卡/阶段块等合成消息）：
 * - 未封段的思考块（thinkingInProgress）→ thinking
 * - 工具调用无 toolResult → tool-running（取工具名）
 * - 有正文流（isStreaming assistant 文本）→ responding
 * - 其余 → analyzing
 *
 * @param messages - 完整消息数组
 * @returns 阶段与附加上下文（工具名）
 */
export function inferStreamStage(messages: ChatMessage[]): { stage: StreamStage; toolName?: string } {
  // 反向扫描：只看末尾的连续流式相关消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;

    // 未封段思考块：思考中
    if (m.isThinking && m.thinkingInProgress) {
      return { stage: 'thinking' };
    }
    // 工具调用无结果：执行中
    if (m.isToolUse && m.toolName && !m.toolResult) {
      return { stage: 'tool-running', toolName: m.toolName };
    }
    // 正文流式消息：响应中（现有 indicator 已覆盖，不重复推断）
    if (m.type === 'assistant' && !m.isToolUse && !m.isThinking && m.isStreaming && m.content) {
      return { stage: 'responding' };
    }
    // 用户消息是边界：扫到这里说明流式相关消息已结束
    if (m.type === 'user') break;
    // 合成消息（任务卡/阶段块）与已完成的消息继续向前扫
  }
  // 默认：分析中（工具都完成了、无新输出 —— prefill/推理空窗）
  return { stage: 'analyzing' };
}

/**
 * 分析中状态的升级文案
 *
 * @param elapsedMs - 空窗持续时间（毫秒）
 * @returns 展示文案
 */
export function analyzingLabel(elapsedMs: number): string {
  if (elapsedMs >= ANALYZING_LONG_WAIT_MS) {
    return '等待模型响应...（可继续等待或停止）';
  }
  if (elapsedMs >= ANALYZING_ESCALATE_MS) {
    return '仍在处理中，较长任务可能需要一点时间...';
  }
  return '正在思考下一步...';
}
