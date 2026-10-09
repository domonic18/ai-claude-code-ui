/**
 * Reply Process Aggregator
 *
 * 回复级过程组：把一条回复内的全部过程性内容（思考段、工具调用、
 * 过渡句）聚合为组头一行的抽屉——「✓ 思考 14 段 · 17 步 · 1m06s」，
 * 主视图只剩正文与交付物。对齐"过程收进抽屉、结果是一等公民"的
 * 信息架构（替代 phaseAggregator + displayOptimizer 两段管线）。
 *
 * 分组规则：
 * - 用户消息是回复边界：其后到下一条用户消息前的过程内容归同一组
 * - 正文封箱：正文消息出现即当前组收口（done），后续过程开新组排在
 *   正文下方——多轮 agentic 呈现「组→正文→组→正文→…→最终回答」，
 *   每段正文是它上方那组过程的小里程碑
 * - 组锚定在组内首条过程内容的位置，永不前移——内容只收进上方抽屉，
 *   不会"瞬移"
 * - 活跃内容例外不入抽屉：进行中的思考段（thinkingInProgress）、尚无
 *   结果的工具在组头下方实时展示，封段/完成后收进抽屉
 * - 交互提问卡（AskUserQuestion）与 error 消息留在主流：前者需要用户
 *   操作，后者是终端态不可埋进折叠区
 * - 任务工具（TaskCreate 等）归 taskListAggregator，本聚合器跳过
 *
 * 纯函数：对同一消息数组重复执行结果恒定，实时流式与历史回放走同一
 * 套逻辑，原始消息数据不动（流式期间每帧重跑，突变会成倍复制）。
 *
 * @module chat/utils/replyProcessAggregator
 */

import type { ChatMessage } from '../types';

/** 时间线条目种类 */
export type ReplyProcessEntryKind = 'thinking' | 'tool' | 'narration';

/** 时间线单条目（抽屉展开区按序排列） */
export interface ReplyProcessEntry {
  kind: ReplyProcessEntryKind;
  /** 思考段全文 / 过渡句文本 */
  text?: string;
  /** 思考段耗时（毫秒） */
  durationMs?: number;
  /** 工具名（原始，如 Bash） */
  toolName?: string;
  /** 语义化动作（如「运行命令」） */
  actionLabel?: string;
  /** 工具摘要（Bash 取命令首行，其余取入参前 80 字符） */
  summary?: string;
  /** 工具是否失败（toolResult.isError） */
  isError?: boolean;
}

/** 组状态：进行中 / 完成 / 有失败 */
export type ReplyProcessStatus = 'active' | 'done' | 'error';

/** 过程组快照（挂在合成消息 replyProcess 上） */
export interface ReplyProcessSnapshot {
  status: ReplyProcessStatus;
  /** 抽屉时间线（已完成条目；活跃条目在 live 区单独展示） */
  entries: ReplyProcessEntry[];
  /** 活跃思考段内容（空串表示无） */
  liveThinking: string;
  /** 活跃执行中的工具（组头「正在执行：XXX」；无则空） */
  liveTool: { actionLabel: string; summary?: string } | null;
  /** 思考段计数（含活跃段） */
  thinkingCount: number;
  /** 工具步数计数（含活跃工具） */
  toolCount: number;
  /** 整轮耗时（毫秒）：透传回复末条正文消息的 durationMs（后端下发），无则 undefined */
  totalDurationMs?: number;
  /** 失败步数 */
  errorCount: number;
  /** 被吸收的消息 id */
  absorbedIds: string[];
}

/** 工具名 → 语义化动作（用户视角的动作描述，对齐竞品认知友好度） */
const TOOL_ACTION_LABELS: Record<string, string> = {
  Bash: '运行命令',
  Read: '读取文档',
  Write: '写入文档',
  Edit: '编辑文档',
  Glob: '检索文件',
  Grep: '检索内容',
  Skill: '调用技能',
  WebSearch: '搜索网页',
  WebFetch: '抓取网页',
  Task: '委派子任务',
};

/** 未知工具的兜底动作名 */
const DEFAULT_ACTION_LABEL = '调用工具';

/** 任务工具归 taskListAggregator 处理（与 phaseAggregator 旧口径一致） */
const TASK_TOOL_NAMES = ['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite'];

/** 旁白判定上限：超过该长度视为正文，宁可留在主流（安全阀） */
const NARRATION_MAX_CHARS = 300;
/** markdown 结构特征（标题/列表/代码块/链接/加粗）——含结构的文本是正文不是旁白 */
const MARKDOWN_PATTERN = /^#{1,6}\s|^\s*[-*+]\s|```|\[.*\]\(|\*\*|^\s*\d+\.\s/;

/**
 * 判断是否为旁白候选（静态部分）：assistant 纯文本、非工具/思考/交互卡、
 * 无 markdown 结构、非流式中、非完成回填。
 *
 * 注意：短 ≠ 旁白（最终回复也可能只有一句话）。是否真吸收还需
 * 前瞻判定（见 narrationFollowedByProcess）：后面跟着过程内容（工具/
 * 思考）才是"动作说明"，否则是正文。
 *
 * 长度上限放宽到 300 字：agentic 模型的干活前旁白常超 60 字（"我来
 * 对生成的 xxx 进行全面验证。验证发现……让我进一步检查……"），按旧
 * 60 字阈值会冒充正文渲染，出现"回答都出了还在思考"的心智错乱。
 * 带 markdown 结构（标题/列表/代码块）的是给用户看的内容，永不吸收。
 */
function isNarrationCandidate(message: ChatMessage): boolean {
  if (message.type !== 'assistant') return false;
  if (message.isToolUse || message.isThinking || message.interactiveQuestion) return false;
  if (message.taskListSnapshot || message.replyProcess) return false;
  if (message.isStreaming) return false;
  if (typeof message.durationMs === 'number') return false; // 完成回填耗时的是正文
  const text = (message.content || '').trim();
  if (!text || text.length > NARRATION_MAX_CHARS) return false;
  if (MARKDOWN_PATTERN.test(text)) return false;
  return true;
}

/**
 * 前瞻判定：短文本是否为过渡句——其后（到回复边界前）还存在过程内容
 * （工具/思考）则为过渡句；否则视为正文（收尾短回复也是正文）
 *
 * @param messages - 完整消息数组
 * @param index - 候选消息索引
 */
function narrationFollowedByProcess(messages: ChatMessage[], index: number): boolean {
  for (let i = index + 1; i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    if (m.type === 'user' || m.type === 'error') return false; // 回复边界：无后续过程
    if ((m.isThinking && m.thinking) || (m.isToolUse && m.toolName && !m.taskListSnapshot)) return true;
  }
  return false;
}

/**
 * 时间戳归一化：流式路径给毫秒数、历史回放给 ISO 字符串或 Date 对象，
 * 统一转毫秒数（无效值返回 null）
 *
 * @param ts - 任意形态时间戳
 * @returns 毫秒数或 null
 */
function toMs(ts: number | string | Date | undefined): number | null {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 判断是否为旁白（narration）：纯文本候选 + 后续跟过程内容（前瞻判定）。
 *
 * 仅吸收"开场旁白"——此前（同一回复内）没有任何过程内容的说明文字
 * （如"让我先检查一下环境："）。中途播报（"自检通过。现在检查…"）
 * 之前已有过程发生，语义是阶段性结果：留在主流并触发正文封箱，
 * 后续过程开新组排在它下方（「组→正文→组→…」节奏）。
 *
 * @param message - 消息对象
 * @param messages - 完整消息数组（前瞻用）
 * @param index - 消息索引
 */
/**
 * 判断是否为旁白（narration）：纯文本候选 + 后续跟过程内容（前瞻判定）。
 * 收尾的短文本是正文，不吸收
 *
 * @param message - 消息对象
 * @param messages - 完整消息数组（前瞻用）
 * @param index - 消息索引
 */
export function isNarration(message: ChatMessage, messages?: ChatMessage[], index?: number): boolean {
  if (!isNarrationCandidate(message)) return false;
  if (messages === undefined || index === undefined) return true; // 无上下文：仅静态判定
  return narrationFollowedByProcess(messages, index);
}

/** 判断是否为任务工具消息（归 taskListAggregator，跳过） */
function isTaskToolMessage(message: ChatMessage): boolean {
  return Boolean(message.isToolUse && message.toolName && TASK_TOOL_NAMES.includes(message.toolName));
}

/** 从 toolInput JSON 提取摘要（Bash 取命令首行，其余取格式化入参） */
function summarizeTool(message: ChatMessage): string {
  if (!message.toolInput) return '';
  if (message.toolName === 'Bash') {
    try {
      const input = JSON.parse(message.toolInput);
      if (typeof input?.command === 'string' && input.command) {
        return (input.command.split('\n')[0] || '').slice(0, 80);
      }
    } catch { /* fallthrough */ }
  }
  return message.toolInput.replace(/\s+/g, ' ').slice(0, 80);
}

/** 工具消息 → 时间线条目 */
function toolEntry(message: ChatMessage): ReplyProcessEntry {
  const toolResult = message.toolResult as { isError?: boolean } | null | undefined;
  const toolName = message.toolName || '';
  return {
    kind: 'tool',
    toolName,
    actionLabel: TOOL_ACTION_LABELS[toolName] || toolName || DEFAULT_ACTION_LABEL,
    summary: summarizeTool(message),
    isError: Boolean(typeof toolResult === 'object' && toolResult !== null && toolResult.isError),
  };
}

/** 判断是否为可吸收的过程消息（不含活跃判定——那是入组时的分流） */
function isProcessCandidate(message: ChatMessage, messages: ChatMessage[], msgIndex: number): boolean {
  if (message.type !== 'assistant') return false;
  if (message.interactiveQuestion) return false; // 交互卡留在主流等用户操作
  if (isTaskToolMessage(message)) return false; // 任务工具归 taskListAggregator
  return Boolean(
    (message.isThinking && message.thinking)
    || (message.isToolUse && message.toolName && !message.taskListSnapshot)
    || isNarration(message, messages, msgIndex)
  );
}

/**
 * 对消息数组执行回复级过程聚合，返回替换后的数组
 *
 * 逐条扫描：用户消息开新组边界；过程内容吸收进当前组（活跃的进 live
 * 区、已完成的进抽屉）；正文/交互卡/错误原样保留。组头合成消息锚定
 * 在组内首条被吸收内容的位置。
 *
 * @param messages - 完整消息数组
 * @returns 替换后的消息数组（原数组与消息对象均不变）
 */
export function withReplyProcess(messages: ChatMessage[]): ChatMessage[] {
  const output: ChatMessage[] = [];

  /** 当前组构建态（null = 不在组内，等下一条用户消息开组） */
  let group: {
    snapshot: ReplyProcessSnapshot;
    /** 组头在 output 中的索引 */
    slotIndex: number;
  } | null = null;

  /** 终态判定：最后一次失败后无成功 → error；否则 done/active */
  const statusOf = (s: ReplyProcessSnapshot, isActive: boolean): ReplyProcessStatus => {
    if (s.errorCount > 0 && !hasSuccessAfterLastError(s)) return 'error';
    return isActive ? 'active' : 'done';
  };

  const hasSuccessAfterLastError = (s: ReplyProcessSnapshot): boolean => {
    let lastErr = -1;
    s.entries.forEach((e, i) => { if (e.isError) lastErr = i; });
    return lastErr < 0 || s.entries.slice(lastErr + 1).some(e => e.kind === 'tool' && !e.isError);
  };

  /** 回复是否已见正文（正文后的组仍可吸收后续过程——多轮 agentic） */
  const placeGroupHeader = (anchor: ChatMessage) => {
    if (!group) return;
    const header: ChatMessage = {
      id: `reply-process-${toMs(anchor.timestamp) ?? output.length}`,
      type: 'assistant',
      content: '',
      timestamp: anchor.timestamp,
      replyProcess: group.snapshot,
    };
    if (group.slotIndex < 0) {
      output.push(header);
      group.slotIndex = output.length - 1;
    } else {
      output[group.slotIndex] = header; // 原位替换（快照同引用，内容已更新）
    }
  };

  /** 记录回复总耗时：组内末条带 durationMs 的正文消息（后端回填的整轮耗时） */
  let lastDurationMs: number | undefined;

  for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
    const message = messages[msgIndex];
    // 用户消息/错误：组收口（保留在 output），开待新组
    if (message.type === 'user' || message.type === 'error') {
      if (group) {
        group.snapshot.status = statusOf(group.snapshot, false);
        group.snapshot.totalDurationMs = lastDurationMs;
        group = null;
      }
      output.push(message);
      continue;
    }

    // 组内正文消息：透传，记录耗时（后端把整轮 durationMs 回填到末条正文）。
    // 正文封箱：正文出现即本轮交付——当前组立即收口（done、清 live），后续
    // 过程开新组排在正文下方。多轮 agentic 呈现「组→正文→组→正文→…→最终
    // 回答」节奏，每段正文是它上方那组过程的小里程碑，消除"回答出了还在
    // 想"的错乱。
    // 注意旁白（纯文本 + 后续跟过程内容）不算正文——它在下方过程分支被吸收进组
    if (message.type === 'assistant' && !message.isToolUse && !message.isThinking && !message.replyProcess && !message.taskListSnapshot && !message.interactiveQuestion && !isNarration(message, messages, msgIndex)) {
      if (typeof message.durationMs === 'number') lastDurationMs = message.durationMs;
      if (group) {
        group.snapshot.status = statusOf(group.snapshot, false);
        group.snapshot.totalDurationMs = lastDurationMs;
        group.snapshot.liveThinking = '';
        group.snapshot.liveTool = null;
        group = null;
      }
      output.push(message);
      continue;
    }

    // 过程内容（思考/工具/过渡句）
    if (isProcessCandidate(message, messages, msgIndex)) {
      if (!group) {
        group = {
          snapshot: {
            status: 'active', entries: [], liveThinking: '', liveTool: null,
            thinkingCount: 0, toolCount: 0, errorCount: 0, absorbedIds: [],
          },
          slotIndex: -1,
        };
        lastDurationMs = undefined; // 新组新计时
      }
      const s = group.snapshot;

      if (message.isThinking && message.thinking) {
        s.thinkingCount++;
        if (message.thinkingInProgress) {
          s.liveThinking = message.thinking; // 活跃段：实时展示，封段后落 entries
        } else {
          s.entries.push({
            kind: 'thinking',
            text: message.thinking,
            ...(typeof message.thinkingDurationMs === 'number' ? { durationMs: message.thinkingDurationMs } : {}),
          });
          s.absorbedIds.push(message.id);
        }
      } else if (message.isToolUse && message.toolName) {
        s.toolCount++;
        const entry = toolEntry(message);
        if (message.toolResult == null) {
          // 尚无结果：执行中，live 区单行
          s.liveTool = { actionLabel: entry.actionLabel, summary: entry.summary };
        } else {
          s.entries.push(entry);
          s.absorbedIds.push(message.id);
          if (entry.isError) {
            s.errorCount++;
          } else if (s.errorCount > 0 && hasSuccessAfterLastError(s)) {
            // 重试成功自愈：失败明细保留在抽屉，组头不报异常
          }
        }
      } else if (isNarration(message, messages, msgIndex)) {
        // 过渡句：立即落时间线（前瞻判定已保证其后有过程内容，无需暂存降级）
        s.entries.push({ kind: 'narration', text: (message.content || '').trim() });
        s.absorbedIds.push(message.id);
      }

      placeGroupHeader(message);
      continue;
    }

    // 其余（交互卡/任务卡/合成消息等）：透传
    output.push(message);
  }

  // 尾组（会话进行中）：保持 active
  if (group) {
    group.snapshot.status = statusOf(group.snapshot, true);
    group.snapshot.totalDurationMs = lastDurationMs;
  }

  return output;
}
