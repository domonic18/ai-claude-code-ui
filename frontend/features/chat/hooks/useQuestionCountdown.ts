/**
 * useQuestionCountdown — AskUserQuestion 卡片倒计时
 *
 * 以「消息到达时刻 + timeoutMs」为单一时间基准计算剩余比例，渲染满格递减的进度线。
 * 不依赖后端推送 tick：容器内 CLI 的 AFK 超时独立计时（归零后模型拿到 afk_timeout
 * 自行决策），前端只是对齐同一时长做视觉提示，因此本地时钟即可，无需与 CLI 同步。
 *
 * tick 策略：interval 每 250ms 重算剩余比例，CSS transition 负责平滑递减；
 * 归零后 isExpired 置位并停止 interval（卡片据此禁用交互——超时后回答不再被采纳）。
 *
 * @module features/chat/hooks/useQuestionCountdown
 */

import { useEffect, useState } from 'react';

/** 倒计时 tick 间隔（ms）：低于 CSS transition 时长，保证进度条视觉连续 */
const TICK_MS = 250;

/** useQuestionCountdown 返回值 */
export interface QuestionCountdown {
  /** 剩余毫秒数（向上取整到秒，避免显示 0s 但还在计时） */
  remainingMs: number;
  /** 剩余比例 0~1（宽度百分比基数） */
  progress: number;
  /** 是否已归零（true 时调用方应停止接受回答） */
  isExpired: boolean;
  /** 是否进入提示阈值（剩余 < 60s，进度条变琥珀色） */
  isWarning: boolean;
}

/**
 * 计算倒计时状态（纯函数，便于测试）
 *
 * @param startedAt - 计时起点时间戳（消息到达时刻）
 * @param timeoutMs - 总时长（ms）
 * @param now - 当前时间戳
 * @returns 剩余毫秒、比例、是否归零、是否进入提示阈值
 */
export function computeCountdown(startedAt: number, timeoutMs: number, now: number): {
  remainingMs: number;
  progress: number;
  isExpired: boolean;
  isWarning: boolean;
} {
  const remainingMs = Math.max(0, startedAt + timeoutMs - now);
  const progress = Math.max(0, Math.min(1, remainingMs / timeoutMs));
  return {
    remainingMs,
    progress,
    isExpired: remainingMs <= 0,
    isWarning: !!(timeoutMs >= 60000 && remainingMs > 0 && remainingMs < 60000),
  };
}

/** 剩余毫秒数格式化为 m:ss（如 4:35） */
export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 问题卡片倒计时 hook
 *
 * @param startedAt - 计时起点时间戳；invalid（0/NaN）时不启动计时
 * @param timeoutMs - 总时长（ms）；<=0 时不启动（后端未下发 timeoutMs 的兼容场景）
 * @param active - 是否计时中（卡片进入终态后停止，避免已回答卡片继续跳动）
 * @returns 倒计时状态（未启动时 remainingMs=timeoutMs、progress=1）
 */
export function useQuestionCountdown(
  startedAt: number,
  timeoutMs: number,
  active: boolean
): QuestionCountdown {
  const valid = active && Number.isFinite(startedAt) && startedAt > 0 && timeoutMs > 0;

  const [state, setState] = useState(() => (
    valid
      ? computeCountdown(startedAt, timeoutMs, Date.now())
      : { remainingMs: timeoutMs, progress: 1, isExpired: false, isWarning: false }
  ));

  useEffect(() => {
    if (!valid) return;
    // 启动即先校准一次（覆盖 hook 挂载与消息到达之间的间隔），再进入周期 tick
    setState(computeCountdown(startedAt, timeoutMs, Date.now()));
    const timer = setInterval(() => {
      // setState 函数式更新：不读 state 闭包，仅用参数计算（React Hooks 规范）
      setState(prev => {
        const next = computeCountdown(startedAt, timeoutMs, Date.now());
        // 归零后停表：isExpired 已稳定，不再触发重渲染
        if (next.isExpired && prev.isExpired) return prev;
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [valid, startedAt, timeoutMs]);

  if (!valid) {
    return { remainingMs: timeoutMs, progress: 1, isExpired: false, isWarning: false };
  }
  return state;
}
