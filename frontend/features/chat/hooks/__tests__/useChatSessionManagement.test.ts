/**
 * useChatSessionManagement Hook Tests
 *
 * 重点覆盖"切项目清 sessionId"修复（防止跨项目 resume 串线）：
 * - 切到不同项目时：setCurrentSessionId(null) + setMessages([]) + setInput('')
 * - 同项目 rerender（仅 path 等其他字段变化）：不触发清理
 * - 首次挂载：跳过，避免误清首屏恢复的会话
 * - 首屏无项目，之后进入某项目：prevName 为 undefined → 跳过
 *
 * 后端 ClaudeQuery.sessionExistsInProject 是兜底防线，前端从源头消除错配请求；
 * 两者配合根治"切项目后 currentSessionId 残留导致 resume 串到错误项目"。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// mock logger（被子 hook 依赖）
vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// mock 兄弟子 hook，聚焦 useChatSessionManagement 自身的 effect 逻辑
vi.mock('../useSessionLoader', () => ({ useSessionLoader: vi.fn() }));
vi.mock('../useSessionSync', () => ({ useSessionSync: vi.fn() }));

import { useChatSessionManagement } from '../useChatSessionManagement';
import type { UseChatSessionManagementOptions } from '../useChatSessionManagement';

/** 构造一份完整的 options，overrides 覆盖个别字段 */
function makeOptions(overrides: Partial<UseChatSessionManagementOptions> = {}): UseChatSessionManagementOptions & {
  setCurrentSessionId: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  setInput: ReturnType<typeof vi.fn>;
} {
  return {
    selectedProject: { name: 'project-A', path: '/workspace/project-A' },
    selectedSession: undefined,
    newSessionCounter: 0,
    currentSessionId: 'session-A',
    authenticatedFetch: vi.fn(),
    setCurrentSessionId: vi.fn(),
    setMessages: vi.fn(),
    setInput: vi.fn(),
    ...overrides,
  } as UseChatSessionManagementOptions & {
    setCurrentSessionId: ReturnType<typeof vi.fn>;
    setMessages: ReturnType<typeof vi.fn>;
    setInput: ReturnType<typeof vi.fn>;
  };
}

describe('useChatSessionManagement - 切项目清 sessionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('切到不同项目时清空 currentSessionId / messages / input', () => {
    const initial = makeOptions();
    const { rerender } = renderHook(
      (props: UseChatSessionManagementOptions) => useChatSessionManagement(props),
      { initialProps: initial }
    );

    // 挂载（project-A）不应触发清理
    expect(initial.setCurrentSessionId).not.toHaveBeenCalled();

    // 切到 project-B
    const next = makeOptions({
      selectedProject: { name: 'project-B', path: '/workspace/project-B' },
    });
    rerender(next);

    expect(next.setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(next.setMessages).toHaveBeenCalledWith([]);
    expect(next.setInput).toHaveBeenCalledWith('');
  });

  it('同项目 rerender（仅 path 变化）不触发清理', () => {
    const initial = makeOptions();
    const { rerender } = renderHook(
      (props: UseChatSessionManagementOptions) => useChatSessionManagement(props),
      { initialProps: initial }
    );

    const next = makeOptions({
      selectedProject: { name: 'project-A', path: '/workspace/changed' },
    });
    rerender(next);

    expect(next.setCurrentSessionId).not.toHaveBeenCalled();
    expect(next.setMessages).not.toHaveBeenCalled();
  });

  it('首次挂载跳过清理（避免误清首屏恢复的会话）', () => {
    const opts = makeOptions(); // 首次 selectedProject = project-A
    renderHook(() => useChatSessionManagement(opts));

    expect(opts.setCurrentSessionId).not.toHaveBeenCalled();
  });

  it('首屏无项目，之后进入某项目不触发清理（prevName === undefined 跳过）', () => {
    const initial = makeOptions({ selectedProject: undefined });
    const { rerender } = renderHook(
      (props: UseChatSessionManagementOptions) => useChatSessionManagement(props),
      { initialProps: initial }
    );

    const next = makeOptions({
      selectedProject: { name: 'project-A', path: '/workspace/project-A' },
    });
    rerender(next);

    // prev=undefined → 跳过，等下一次真正的项目切换才清理
    expect(next.setCurrentSessionId).not.toHaveBeenCalled();
  });
});
