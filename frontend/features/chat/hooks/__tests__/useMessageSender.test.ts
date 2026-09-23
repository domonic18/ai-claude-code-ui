/**
 * useMessageSender - handleSend 即时置顶测试
 *
 * 守护：发送消息瞬间必须调用 touchProjectLocally(selectedProject.name)
 * （本地置顶，不发请求不闪 loading）。touchProjectLocally 由 useProjects
 * 挂载在 window 上；不存在时静默跳过不报错。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageSender } from '../useMessageSender';

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    input: '你好',
    isLoading: false,
    currentSessionId: null,
    attachedFiles: [],
    selectedModel: 'test-model',
    selectedProject: { name: '专利调研', displayName: '专利调研' },
    ws: { readyState: 1 },
    sendMessage: vi.fn(),
    onAddMessage: vi.fn(),
    onStartStream: vi.fn(),
    onSetLoading: vi.fn(),
    onSetInput: vi.fn(),
    onSetAttachedFiles: vi.fn(),
    onSessionActive: vi.fn(),
    onSessionProcessing: vi.fn(),
    permissionMode: 'default',
    extendedThinking: false,
    isDirectMode: false,
    currentSessionProvider: 'claude',
    ...overrides,
  } as any;
}

describe('useMessageSender - 发消息即时置顶', () => {
  let touch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    touch = vi.fn();
    (window as any).touchProjectLocally = touch;
  });
  afterEach(() => {
    delete (window as any).touchProjectLocally;
  });

  it('发送消息时调用 touchProjectLocally(当前项目名)', async () => {
    const { result } = renderHook(() => useMessageSender(makeOptions()));

    await act(async () => { await result.current.handleSend(); });

    expect(touch).toHaveBeenCalledTimes(1);
    expect(touch).toHaveBeenCalledWith('专利调研');
  });

  it('输入为空时不发送也不置顶', async () => {
    const { result } = renderHook(() => useMessageSender(makeOptions({ input: '   ' })));

    await act(async () => { await result.current.handleSend(); });

    expect(touch).not.toHaveBeenCalled();
  });

  it('touchProjectLocally 未挂载时发送不报错（测试环境/未登录）', async () => {
    delete (window as any).touchProjectLocally;
    const { result } = renderHook(() => useMessageSender(makeOptions()));

    await expect(act(async () => { await result.current.handleSend(); })).resolves.not.toThrow();
  });

  it('作为 user-answer 发送时也置顶（Agent 提问回答路径）', async () => {
    const consumePendingQuestion = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useMessageSender(makeOptions({ consumePendingQuestion })));

    await act(async () => { await result.current.handleSend(); });

    expect(consumePendingQuestion).toHaveBeenCalled();
    expect(touch).toHaveBeenCalledTimes(1);
  });
});
