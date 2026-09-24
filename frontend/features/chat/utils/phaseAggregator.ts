/**
 * Phase Aggregator
 *
 * 将 agentic 前置阶段（技能加载/环境自检/文件检索）的琐碎事件流聚合为
 * 单一阶段块「正在准备环境...」，收口后一行摘要「环境准备完成（检索 12
 * 次 · 自检 3 项）」，仅失败项弹出单独展示。
 *
 * 轻量判定规则（详见 LIGHT_TOOL_NAMES / BASH_LIGHT_PATTERNS）：
 * - Glob/Grep/Read/Skill 无条件轻量
 * - Bash 按命令模式匹配：自检脚本、版本/可执行探测、目录探测为轻量；
 *   其余（编译/转换/curl/复杂检索）为重操作，照常展示并触发收口
 *
 * 聚合为纯函数（与 taskListAggregator 同模式）：对同一份 messages 重复
 * 执行结果恒定，实时流式与历史回放走同一套逻辑，原始消息数据不动。
 *
 * @module chat/utils/phaseAggregator
 */

import type { ChatMessage } from '../types';

/** 无条件视为轻量的工具名（检索/准备类） */
export const LIGHT_TOOL_NAMES = ['Glob', 'Grep', 'Read', 'Skill'] as const;

/** Bash 轻量命令模式：环境自检与探测（按真实 PCT 工作流校准） */
const BASH_LIGHT_PATTERNS: RegExp[] = [
  /officecli_self_check\.py/,   // OfficeCLI 部署自检
  /pct_selftest\.py/,           // PCT 工具包自检
  /selftest_.*\.py/,            // 各技能 core tests 自检（selftest_xxx.py）
  /selftest\.py/,               // 裸命名自检脚本
  /skills\/[^ ]*scripts\//,     // 技能 scripts/ 目录下的支撑脚本调用（准备性质）
  /--version\b/,                // 版本探测
  /\bcommand -v\b|\bwhich\b/,   // 可执行文件探测
  /^ls\b/,                      // 目录探测（锚定行首，排除组合命令）
  /^pwd\b/,
  /^echo\b/,
  /^mkdir -p\b/,                // 准备输出目录
];

/** 聚合安全阀：单个阶段块吸收的最大事件数，超过强制收口重开 */
const MAX_PHASE_EVENTS = 30;

/**
 * 判断消息是否为聚合目标（轻量事件）
 *
 * @param message - 消息对象
 * @returns 是否轻量
 */
export function isLightEvent(message: ChatMessage): boolean {
  if (!message.isToolUse || !message.toolName) return false;
  // 任务工具已由 taskListAggregator 处理，不重复归
  if (['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite'].includes(message.toolName)) return false;
  if ((LIGHT_TOOL_NAMES as readonly string[]).includes(message.toolName)) return true;
  if (message.toolName === 'Bash') {
    try {
      const input = message.toolInput ? JSON.parse(message.toolInput) : null;
      const command = typeof input?.command === 'string' ? input.command : '';
      if (!command) return false;
      return BASH_LIGHT_PATTERNS.some(p => p.test(command));
    } catch {
      return false;
    }
  }
  return false;
}

/** 聚合块吸收的事件明细（展开区展示） */
export interface PhaseEventDetail {
  /** 工具名 */
  toolName: string;
  /** 摘要（Bash 取命令首行，其余取 toolInput 前 80 字符） */
  summary: string;
  /** 是否失败（toolResult.isError） */
  isError: boolean;
}

/** 聚合块携带的数据（挂在合成消息 phaseSnapshot 上） */
export interface PhaseSnapshot {
  /** 阶段状态：进行中 / 完成 / 异常 */
  status: 'active' | 'done' | 'error';
  /** 吸收的事件明细（含失败项，展开区展示） */
  events: PhaseEventDetail[];
  /** 吸收的思考段（聚合期间到达的思考块，展开区展示） */
  thinkingSegments: Array<{ thinking: string; thinkingDurationMs?: number }>;
  /** 被吸收的消息 id（隐藏原消息用） */
  absorbedIds: string[];
}

/** reduce 过程中的可变聚合状态 */
interface PhaseBuildState {
  snapshot: PhaseSnapshot | null;
}

/** 生成事件摘要 */
function summarizeEvent(message: ChatMessage): PhaseEventDetail {
  let summary = '';
  if (message.toolName === 'Bash') {
    try {
      const input = message.toolInput ? JSON.parse(message.toolInput) : null;
      const command = typeof input?.command === 'string' ? input.command : '';
      summary = (command.split('\n')[0] || '').slice(0, 80);
    } catch { /* fallthrough */ }
  }
  if (!summary && message.toolInput) {
    summary = message.toolInput.replace(/\s+/g, ' ').slice(0, 80);
  }
  const toolResult = message.toolResult as any;
  const isError = Boolean(
    typeof toolResult === 'object' && toolResult !== null && toolResult.isError
  );
  return { toolName: message.toolName || '', summary, isError };
}

/** 收口当前聚合块：有失败项 → error 态；否则 done 态 */
function sealPhase(build: PhaseBuildState): void {
  if (!build.snapshot) return;
  build.snapshot.status = build.snapshot.events.some(e => e.isError) ? 'error' : 'done';
  build.snapshot = null;
}

/**
 * 对消息数组执行阶段聚合，返回替换后的数组
 *
 * 逐条扫描：轻量事件吸收进当前聚合块（无则开启），思考段消息吸收，
 * 其余消息（重操作/用户消息/错误）触发收口后原样保留。
 * 吸收失败项时聚合块立即置 error 态（不再吸收后续轻量事件，收口展示）。
 *
 * @param messages - 完整消息数组
 * @returns 替换后的消息数组（原数组不变）
 */
export function withAggregatedPhases(messages: ChatMessage[]): ChatMessage[] {
  const build: PhaseBuildState = { snapshot: null };
  /** 合成块输出位置：插在最后一个被吸收消息处 */
  const output: ChatMessage[] = [];
  /** 每个合成块吸收完毕时的占位索引（output 中的位置） */
  let phaseSlotIndex = -1;

  for (const message of messages) {
    // 思考段消息：聚合中则吸收，否则原样保留
    if (message.isThinking && message.thinking) {
      if (build.snapshot) {
        build.snapshot.thinkingSegments.push({
          thinking: message.thinking,
          ...(typeof message.thinkingDurationMs === 'number' ? { thinkingDurationMs: message.thinkingDurationMs } : {}),
        });
        build.snapshot.absorbedIds.push(message.id);
        // 合成块已在 output 中，更新其 snapshot（合成块是独立对象，直接可变）
        continue;
      }
      output.push(message);
      continue;
    }

    if (isLightEvent(message)) {
      const detail = summarizeEvent(message);
      if (detail.isError) {
        // 失败项：吸收并置异常态，然后收口（失败明细在展开区）
        if (!build.snapshot) {
          build.snapshot = { status: 'active', events: [], thinkingSegments: [], absorbedIds: [] };
          output.push(buildPhaseMessage(message, build.snapshot));
          phaseSlotIndex = output.length - 1;
        }
        build.snapshot.events.push(detail);
        build.snapshot.absorbedIds.push(message.id);
        sealPhase(build);
        phaseSlotIndex = -1;
        continue;
      }
      // 成功的轻量事件：吸收或开新块
      if (!build.snapshot) {
        build.snapshot = { status: 'active', events: [], thinkingSegments: [], absorbedIds: [] };
        output.push(buildPhaseMessage(message, build.snapshot));
        phaseSlotIndex = output.length - 1;
      }
      build.snapshot.events.push(detail);
      build.snapshot.absorbedIds.push(message.id);
      // 安全阀：超过上限强制收口（下个轻量事件开新块）
      if (build.snapshot.events.length >= MAX_PHASE_EVENTS) {
        sealPhase(build);
        phaseSlotIndex = -1;
      }
      continue;
    }

    // 非轻量消息：收口当前块（如有），原样保留
    sealPhase(build);
    phaseSlotIndex = -1;
    output.push(message);
  }

  // 会话结束仍未收口的块保持 active（流式中「正在准备环境...」）
  return output;
}

/**
 * 构造聚合块合成消息
 *
 * snapshot 为可变引用：后续吸收的事件直接 push 进同一对象，
 * 渲染层拿到的是最新状态（渲染由 React 状态驱动，合成块随消息数组变化重渲染）。
 */
function buildPhaseMessage(anchor: ChatMessage, snapshot: PhaseSnapshot): ChatMessage {
  return {
    id: `phase-${anchor.id}`,
    type: 'assistant',
    content: '',
    timestamp: anchor.timestamp,
    phaseSnapshot: snapshot,
  };
}
