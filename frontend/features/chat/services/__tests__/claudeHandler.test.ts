/**
 * claudeHandler 错误处理器测试
 *
 * 重点覆盖：
 * - handleBackendError（type:'error'）：置 loading=false + 显示错误消息
 *   （修复：此前该类型未注册处理器，后端失败被静默丢弃）
 * - handleClaudeError（type:'claude-error'）：复位 loading + 按会话清空 pendingQuestion
 * - handleAgentQuestion：置位 pendingQuestion 并解除 loading（用户可输入回答）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { handleBackendError, handleClaudeError, handleAgentQuestion, handleAgentQuestionAutoAnswered } from '../claudeHandler';
import type { MessageHandlerCallbacks } from '../types';

/** 构造满足 MessageHandlerCallbacks 必需字段的 mock 回调集合 */
function makeCallbacks(): MessageHandlerCallbacks {
  return {
    onAddMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    onSetMessages: vi.fn(),
    onSetLoading: vi.fn(),
    onSetSessionId: vi.fn(),
    completeStream: vi.fn(),
    clearPendingQuestion: vi.fn(),
    setPendingQuestion: vi.fn(),
    onAutoAnswerQuestion: vi.fn(),
    getCurrentSessionId: vi.fn().mockReturnValue('session-A'),
    getSelectedProjectName: vi.fn().mockReturnValue('project-A'),
  } as unknown as MessageHandlerCallbacks;
}

describe('claudeHandler - handleBackendError', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('停止加载并以 error 消息展示错误内容', () => {
    const message = { type: 'error', error: 'Session not found or access denied', sessionId: 'session-A' };

    const result = handleBackendError(message as any, callbacks);

    expect(result).toBe(true);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
    expect(callbacks.completeStream).toHaveBeenCalled();
    expect(callbacks.onAddMessage).toHaveBeenCalledTimes(1);
    const added = (callbacks.onAddMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.type).toBe('error');
    expect(added.content).toContain('Session not found');
  });

  it('缺少 error 字段时展示兜底文案', () => {
    const message = { type: 'error', sessionId: 'session-A' };

    handleBackendError(message as any, callbacks);

    const added = (callbacks.onAddMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.type).toBe('error');
    expect(added.content.length).toBeGreaterThan(0);
  });
});

describe('claudeHandler - handleClaudeError', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('停止加载并按会话清空 pendingQuestion', () => {
    const message = { type: 'claude-error', error: 'SDK crashed', sessionId: 'session-A' };

    const result = handleClaudeError(message as any, callbacks);

    expect(result).toBe(true);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
    expect(callbacks.completeStream).toHaveBeenCalled();
    expect(callbacks.clearPendingQuestion).toHaveBeenCalledWith('session-A');
  });

  it('消息无 sessionId 时不调用 clearPendingQuestion', () => {
    const message = { type: 'claude-error', error: 'SDK crashed' };

    handleClaudeError(message as any, callbacks);

    expect(callbacks.clearPendingQuestion).not.toHaveBeenCalled();
  });
});

describe('claudeHandler - handleAgentQuestionAutoAnswered', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('恢复 loading（模型继续推理）并把摘要交给 onAutoAnswerQuestion（卡片置终态）', () => {
    const message = {
      type: 'agent-question-auto-answered',
      sessionId: 'session-A',
      data: {
        toolUseID: 'toolu_1',
        answers: { '整体策略?': '授权优先版（推荐）', '启用哪些功能?': '检索（推荐）' },
        response: '',
        reason: 'afk_timeout',
      },
    };

    const result = handleAgentQuestionAutoAnswered(message as any, callbacks);

    expect(result).toBe(true);
    // 自动采用后模型继续推理：loading 置 true（与用户手动提交语义一致）
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(true);
    expect(callbacks.onAutoAnswerQuestion).toHaveBeenCalledWith('toolu_1', '授权优先版（推荐）；检索（推荐）');
  });

  it('text 降级通道：摘要取 response 字段', () => {
    const message = {
      type: 'agent-question-auto-answered',
      sessionId: 'session-A',
      data: { toolUseID: 'toolu_2', answers: {}, response: '继续', reason: 'afk_timeout' },
    };

    handleAgentQuestionAutoAnswered(message as any, callbacks);

    expect(callbacks.onAutoAnswerQuestion).toHaveBeenCalledWith('toolu_2', '继续');
  });

  it('缺少 toolUseID 时容错跳过（不触发回调）', () => {
    const message = { type: 'agent-question-auto-answered', sessionId: 'session-A', data: { answers: {} } };

    const result = handleAgentQuestionAutoAnswered(message as any, callbacks);

    expect(result).toBe(true);
    expect(callbacks.onSetLoading).not.toHaveBeenCalled();
    expect(callbacks.onAutoAnswerQuestion).not.toHaveBeenCalled();
  });
});

describe('claudeHandler - handleAgentQuestion', () => {
  let callbacks: MessageHandlerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = makeCallbacks();
  });

  it('解除 loading 并置位 pendingQuestion（用户下一条输入作为回答）', () => {
    const message = {
      type: 'agent-question',
      sessionId: 'session-A',
      data: { toolUseID: 'toolu_1', questions: [], prompt: '选哪个方案？' },
    };

    const result = handleAgentQuestion(message as any, callbacks);

    expect(result).toBe(true);
    expect(callbacks.onSetLoading).toHaveBeenCalledWith(false);
    expect(callbacks.setPendingQuestion).toHaveBeenCalledWith('toolu_1', 'session-A');
    expect(callbacks.onAddMessage).toHaveBeenCalledTimes(1);
  });

  it('携带 timeoutMs 时透传到 interactiveQuestion（倒计时渲染依据）', () => {
    const message = {
      type: 'agent-question',
      sessionId: 'session-A',
      data: { toolUseID: 'toolu_1', questions: [], prompt: '选哪个方案？', timeoutMs: 300000 },
    };

    handleAgentQuestion(message as any, callbacks);

    const added = (callbacks.onAddMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.interactiveQuestion.timeoutMs).toBe(300000);
  });

  it('未携带 timeoutMs 时字段缺省（不显示倒计时）', () => {
    const message = {
      type: 'agent-question',
      sessionId: 'session-A',
      data: { toolUseID: 'toolu_1', questions: [], prompt: '选哪个方案？' },
    };

    handleAgentQuestion(message as any, callbacks);

    const added = (callbacks.onAddMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.interactiveQuestion.timeoutMs).toBeUndefined();
  });

  it('缺少 toolUseID 或 sessionId 时展示无法回答的错误提示，不置位 pendingQuestion', () => {
    const message = {
      type: 'agent-question',
      sessionId: 'session-A',
      data: { questions: [], prompt: '选哪个方案？' }, // 无 toolUseID
    };

    handleAgentQuestion(message as any, callbacks);

    expect(callbacks.setPendingQuestion).not.toHaveBeenCalled();
    const added = (callbacks.onAddMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.type).toBe('error');
    expect(added.content).toContain('Unable to accept answer');
  });
});
