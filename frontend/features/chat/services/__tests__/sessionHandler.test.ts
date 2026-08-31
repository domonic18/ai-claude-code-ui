/**
 * sessionHandler Tests
 *
 * 重点覆盖 handleClaudeComplete：
 * - 当前会话匹配时：调用 completeStream + onSetLoading(false)
 * - 跨视图（会话不匹配）时：completeStream 不调用，但 onSetLoading(false) 仍调用
 *   （核心修复：避免跨视图流结束后输入框永久禁用）
 * - 会话非活跃标记、缓存清理、新会话(currentSessionId=null)兜底
 *
 * 不 mock sessionStateManager，用真实逻辑 + 构造输入控制 isCurrentSessionMatch 返回值。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { handleClaudeComplete, handleSessionAborted } from '../sessionHandler';
import type { MessageHandlerCallbacks } from '../types';

/** 构造满足 MessageHandlerCallbacks 必需字段的 mock 回调集合 */
function makeCallbacks(): MessageHandlerCallbacks {
  return {
    onAddMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    onSetMessages: vi.fn(),
    onSetLoading: vi.fn(),
    onSetSessionId: vi.fn(),
    onSessionInactive: vi.fn(),
    onSessionNotProcessing: vi.fn(),
    completeStream: vi.fn(),
    clearPendingQuestion: vi.fn(),
    getCurrentSessionId: vi.fn().mockReturnValue('session-A'),
    getSelectedProjectName: vi.fn().mockReturnValue('project-A'),
  } as unknown as MessageHandlerCallbacks;
}

describe('sessionHandler - handleClaudeComplete', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('当前会话匹配时：调用 completeStream 并 onSetLoading(false)', () => {
    // isCurrentSessionMatch: completedSessionId === currentSessionId → true
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    const result = handleClaudeComplete(message as any, callbacks, 'session-A');

    expect(result).toBe(true);
    expect(callbacks.completeStream).toHaveBeenCalledTimes(1);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
  });

  it('跨视图（会话不匹配）时：不调用 completeStream，但仍调用 onSetLoading(false) 防止输入框卡死', () => {
    // isCurrentSessionMatch: 'session-A' === 'session-B' → false
    // 模拟用户在项目 A 发消息后已切到项目 B，A 的流式在 B 视图期间结束
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, 'session-B');

    expect(callbacks.completeStream).not.toHaveBeenCalled();
    // 关键修复：跨视图结束也必须清 loading，否则输入框永久禁用
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
  });

  it('会话结束时将会话标记为非活跃 / 不在处理', () => {
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, 'session-A');

    expect(callbacks.onSessionInactive).toHaveBeenCalledWith('session-A');
    expect(callbacks.onSessionNotProcessing).toHaveBeenCalledWith('session-A');
  });

  it('exitCode=0 时通过 getSelectedProjectName 触发对应项目的缓存清理', () => {
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, 'session-A');

    // clearChatMessagesCache 内部调用 getSelectedProjectName() 决定清理哪个项目的缓存
    expect(callbacks.getSelectedProjectName).toHaveBeenCalled();
  });

  it('currentSessionId 为 null（新会话首条）时视为当前会话，正常完成流式', () => {
    // isCurrentSessionMatch: !currentSessionId → true（新会话兜底）
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, null);

    expect(callbacks.completeStream).toHaveBeenCalledTimes(1);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
  });

  it('始终返回 true', () => {
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };
    expect(handleClaudeComplete(message as any, callbacks, 'session-A')).toBe(true);
  });

  it('会话结束时清空该会话的 pendingQuestion（防止残留提问把下一条消息误路由为 user-answer）', () => {
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, 'session-A');

    expect(callbacks.clearPendingQuestion).toHaveBeenCalledWith('session-A');
  });

  it('跨视图结束时同样清空结束会话的 pendingQuestion', () => {
    const message = { type: 'claude-complete', sessionId: 'session-A', exitCode: 0 };

    handleClaudeComplete(message as any, callbacks, 'session-B');

    expect(callbacks.clearPendingQuestion).toHaveBeenCalledWith('session-A');
  });
});

describe('sessionHandler - handleSessionAborted', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('中断当前会话时停止加载并清空该会话的 pendingQuestion', () => {
    const message = { type: 'session-aborted', sessionId: 'session-A' };

    const result = handleSessionAborted(message as any, callbacks, 'session-A');

    expect(result).toBe(true);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
    expect(callbacks.clearPendingQuestion).toHaveBeenCalledWith('session-A');
  });

  it('中断的会话与当前视图不一致时仍清空该中断会话的 pendingQuestion', () => {
    const message = { type: 'session-aborted', sessionId: 'session-B' };

    handleSessionAborted(message as any, callbacks, 'session-A');

    expect(callbacks.clearPendingQuestion).toHaveBeenCalledWith('session-B');
  });
});
