/**
 * useModelsLoader Hook 测试
 *
 * 重点覆盖模型列表 localStorage 缓存（修复每次进页面 "Loading models..." 闪烁）：
 * - 有有效缓存时首帧即返回缓存列表（不等待 fetch）
 * - fetch 成功后更新列表并写回缓存
 * - 坏缓存（非数组/缺字段/坏 JSON）回退空数组，不崩溃
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { useModelsLoader } from '../useModelsLoader';
import { STORAGE_KEYS } from '@/shared/constants';

describe('useModelsLoader', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('无缓存时初始为空数组，fetch 成功后返回列表并写入缓存', async () => {
    const models = [{ name: 'kimi-k2.6', provider: 'Moonshot AI' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, models }),
    }));

    const { result } = renderHook(() => useModelsLoader());

    // 首帧：无缓存 → 空数组
    expect(result.current.availableModels).toEqual([]);

    await waitFor(() => {
      expect(result.current.availableModels).toEqual(models);
    });

    // 缓存已写入，供下次首帧使用
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.AVAILABLE_MODELS) || 'null')).toEqual(models);
  });

  it('有有效缓存时首帧即返回缓存（消除 Loading 闪烁）', () => {
    const cached = [
      { name: 'kimi-k2.6', provider: 'Moonshot AI' },
      { name: 'glm-5', provider: 'Zhipu GLM' },
    ];
    localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(cached));
    // fetch 永不 resolve，验证首帧不依赖网络
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() => useModelsLoader());

    expect(result.current.availableModels).toEqual(cached);
  });

  it('坏缓存（非对象元素/缺 provider）回退空数组', () => {
    localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(['kimi-k2.6', 42]));
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() => useModelsLoader());

    expect(result.current.availableModels).toEqual([]);
  });

  it('缓存为坏 JSON 时回退空数组且不抛异常', () => {
    localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, '{not valid json');
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    const { result } = renderHook(() => useModelsLoader());

    expect(result.current.availableModels).toEqual([]);
  });

  it('fetch 失败（success:false 或 reject）时保留缓存数据不覆盖', async () => {
    const cached = [{ name: 'kimi-k2.6', provider: 'Moonshot AI' }];
    localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(cached));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { result } = renderHook(() => useModelsLoader());

    // 等 fetch 的 catch 分支跑完
    await act(async () => { await Promise.resolve(); });

    expect(result.current.availableModels).toEqual(cached);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.AVAILABLE_MODELS) || 'null')).toEqual(cached);
  });
});
