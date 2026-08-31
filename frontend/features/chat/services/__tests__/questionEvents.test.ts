/**
 * questionEvents 桥接测试
 *
 * 覆盖 QuestionCard → useChatInterface 的提交动作注册/派发/注销生命周期：
 * - 注册后派发可达
 * - 未注册时派发返回 false（静默降级不抛错）
 * - 注销后不再触达旧动作（防过期闭包）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { registerQuestionSubmit, unregisterQuestionSubmit, dispatchQuestionAnswer } from '../questionEvents';

describe('questionEvents 桥接', () => {
  beforeEach(() => {
    unregisterQuestionSubmit();
  });

  it('注册后派发：动作收到完整参数（toolUseID/sessionId/payload/summary）', () => {
    const action = vi.fn();
    registerQuestionSubmit(action);

    const handled = dispatchQuestionAnswer('tu_1', 'session-A', { mode: 'skip' }, '已跳过');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledWith('tu_1', 'session-A', { mode: 'skip' }, '已跳过');
  });

  it('未注册时派发返回 false，不抛错（卡片可安全降级）', () => {
    expect(() => {
      const handled = dispatchQuestionAnswer('tu_1', 's', { mode: 'text', response: 'x' }, 'x');
      expect(handled).toBe(false);
    }).not.toThrow();
  });

  it('注销后旧动作不再被调用', () => {
    const action = vi.fn();
    registerQuestionSubmit(action);
    unregisterQuestionSubmit();

    dispatchQuestionAnswer('tu_1', 's', { mode: 'skip' }, '');

    expect(action).not.toHaveBeenCalled();
  });

  it('重复注册以最后一次为准', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerQuestionSubmit(first);
    registerQuestionSubmit(second);

    dispatchQuestionAnswer('tu_1', 's', { mode: 'skip' }, '');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
