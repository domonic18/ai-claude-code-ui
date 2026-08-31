/**
 * useQuestionCountdown 测试
 *
 * 覆盖：
 * - computeCountdown 纯函数边界（满格/归零/钳制/提示阈值）
 * - hook 行为：未下发 timeoutMs 不启动、归零后 isExpired 置位并停止 tick、
 *   active=false（终态）冻结计时
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { computeCountdown, formatRemaining, useQuestionCountdown } from '../useQuestionCountdown';

describe('computeCountdown - 纯函数', () => {
  const T = 300000; // 5 分钟，与后端 QUESTION_AFK_TIMEOUT_MS 一致

  it('起始时刻：满格、不超时、不警告', () => {
    const r = computeCountdown(1000, T, 1000);
    expect(r.progress).toBe(1);
    expect(r.remainingMs).toBe(T);
    expect(r.isExpired).toBe(false);
    expect(r.isWarning).toBe(false);
  });

  it('流逝一半：比例 0.5', () => {
    const r = computeCountdown(1000, T, 1000 + T / 2);
    expect(r.progress).toBeCloseTo(0.5);
  });

  it('剩余进入最后 60s：isWarning 置位', () => {
    const r = computeCountdown(1000, T, 1000 + T - 30000);
    expect(r.isWarning).toBe(true);
    expect(r.isExpired).toBe(false);
  });

  it('超过时长：归零并钳制（progress 不为负）', () => {
    const r = computeCountdown(1000, T, 1000 + T + 5000);
    expect(r.remainingMs).toBe(0);
    expect(r.progress).toBe(0);
    expect(r.isExpired).toBe(true);
  });

  it('短超时（<60s）不进入 warning（阈值不适用）', () => {
    const r = computeCountdown(1000, 30000, 1000 + 1000);
    expect(r.isWarning).toBe(false);
  });
});

describe('formatRemaining', () => {
  it('m:ss 格式，秒补零，向上取整到秒', () => {
    expect(formatRemaining(300000)).toBe('5:00');
    expect(formatRemaining(274000)).toBe('4:34'); // 274s = 4m34s
    expect(formatRemaining(61000)).toBe('1:01');
    expect(formatRemaining(1)).toBe('0:01'); // ceil(0.001)=1
    expect(formatRemaining(0)).toBe('0:00');
  });
});

describe('useQuestionCountdown - hook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('timeoutMs<=0（后端未下发）：不启动计时，保持满格', () => {
    const { result } = renderHook(() => useQuestionCountdown(Date.now(), 0, true));
    expect(result.current.progress).toBe(1);
    expect(result.current.isExpired).toBe(false);
  });

  it('active=false（卡片终态）：冻结计时', () => {
    const { result } = renderHook(() => useQuestionCountdown(Date.now(), 1000, false));
    expect(result.current.progress).toBe(1);
    expect(result.current.isExpired).toBe(false);
  });

  it('归零后 isExpired 置位', () => {
    vi.useFakeTimers();
    // startedAt 取当前假时钟时刻，避免真实时间漂移
    const startedAt = Date.now();
    const { result } = renderHook(() => useQuestionCountdown(startedAt, 1000, true));
    expect(result.current.isExpired).toBe(false);

    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current.isExpired).toBe(true);
    expect(result.current.progress).toBe(0);
  });

  it('归零后再走时间不再变化（停表，无多余渲染状态）', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const { result } = renderHook(() => useQuestionCountdown(startedAt, 500, true));
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.isExpired).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    // 停表后 remainingMs 保持 0
    expect(result.current.remainingMs).toBe(0);
  });
});
