/**
 * useDocuments Hook Tests
 *
 * 测试关键行为：
 * - addAIDocument 补上 summary_status: 'pending'
 * - polling 同时检查 uploads 和 aiGenerated 的 pending 状态
 * - pending 变 ready 后轮询停止
 * - projectName 为 null 不发送请求
 *
 * @module features/documents/hooks/__tests__/useDocuments.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Mock 依赖 ─────────────────────────────────────────

const mockFetchDocuments = vi.fn();
const mockUploadDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockUpdateDocumentSummary = vi.fn();
const mockRegenerateDocumentSummary = vi.fn();

vi.mock('@/features/documents/services/documentService', () => ({
  fetchDocuments: (...args) => mockFetchDocuments(...args),
  uploadDocument: (...args) => mockUploadDocument(...args),
  deleteDocument: (...args) => mockDeleteDocument(...args),
  updateDocumentSummary: (...args) => mockUpdateDocumentSummary(...args),
  regenerateDocumentSummary: (...args) => mockRegenerateDocumentSummary(...args),
}));

// documentEvents 事件总线：保存回调引用
let documentCreatedHandler = null;

vi.mock('@/features/documents/services/documentEvents', () => ({
  onDocumentCreated: (handler) => {
    documentCreatedHandler = handler;
    return () => { documentCreatedHandler = null; };
  },
  onDocumentUploaded: () => () => {},
  onConversationComplete: () => () => {},
  emitDocumentCreated: vi.fn(),
  emitDocumentUploaded: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── 测试 ─────────────────────────────────────────────

import { useDocuments } from '../useDocuments';

/** 生成一个文档项 */
function makeDoc(overrides = {}) {
  return {
    file_name: 'test.pdf',
    file_path: '/workspace/proj/test.pdf',
    file_size: 1024,
    type: 'upload',
    summary_status: 'ready',
    summary: '测试摘要',
    ...overrides,
  };
}

const EMPTY_RESPONSE = { uploads: [], aiGenerated: [] };

/** 创建 QueryClient + wrapper */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

describe('useDocuments', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchDocuments.mockResolvedValue({ ...EMPTY_RESPONSE });
    mockUploadDocument.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);
    mockUpdateDocumentSummary.mockResolvedValue(undefined);
    mockRegenerateDocumentSummary.mockResolvedValue(undefined);
    documentCreatedHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── addAIDocument ──────────────────────────────────

  describe('addAIDocument', () => {
    it('应补上 summary_status: pending', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });

      // 等待初始 query 完成
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      const doc = {
        file_name: 'ai-doc.md',
        file_path: '/workspace/proj/ai-doc.md',
        type: 'ai_generated',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
      };

      act(() => {
        documentCreatedHandler?.(doc);
      });

      await waitFor(() => {
        const aiDocs = result.current.aiGenerated;
        expect(aiDocs.length).toBe(1);
        expect(aiDocs[0].summary_status).toBe('pending');
        expect(aiDocs[0].file_name).toBe('ai-doc.md');
      });
    });

    it('不应重复添加相同 file_path 的文档', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      const doc = makeDoc({
        file_path: '/workspace/proj/dup.pdf',
        file_name: 'dup.pdf',
        type: 'ai_generated',
      });

      act(() => { documentCreatedHandler?.(doc); });
      act(() => { documentCreatedHandler?.(doc); });

      await waitFor(() => {
        expect(result.current.aiGenerated.length).toBe(1);
      });
    });

    it('保留已有的 summary_status 和 summary', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      const doc = makeDoc({
        type: 'ai_generated',
        summary_status: 'ready',
        summary: '已有摘要',
      });

      act(() => { documentCreatedHandler?.(doc); });

      await waitFor(() => {
        expect(result.current.aiGenerated[0].summary_status).toBe('ready');
        expect(result.current.aiGenerated[0].summary).toBe('已有摘要');
      });
    });
  });

  // ─── 乐观合并层（竞态修复）─────────────────────────

  describe('乐观合并层（竞态修复）', () => {
    it('refetch 返回不含乐观文档时不覆盖乐观文档', async () => {
      const { wrapper } = createWrapper();
      // 服务端始终返回空，模拟 recordAIDocument 尚未完成
      mockFetchDocuments.mockResolvedValue({ uploads: [], aiGenerated: [] });

      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      // WebSocket 推送 → 乐观文档写入
      act(() => {
        documentCreatedHandler?.({
          file_name: 'ai-doc.md',
          file_path: '/workspace/proj/ai-doc.md',
          type: 'ai_generated',
          conversation_id: 'c1',
          message_id: 'm1',
        });
      });
      await waitFor(() => expect(result.current.aiGenerated.length).toBe(1));

      // 推进时间触发轮询 refetch（服务端 record 仍未完成，列表为空）
      act(() => { vi.advanceTimersByTime(5_000); });
      await waitFor(() => expect(mockFetchDocuments.mock.calls.length).toBeGreaterThanOrEqual(2));

      // 关键断言：服务端返回空，但乐观文档仍在（未被 refetch 覆盖）
      expect(result.current.aiGenerated.length).toBe(1);
      expect(result.current.aiGenerated[0].file_path).toBe('/workspace/proj/ai-doc.md');
    });

    it('服务端返回该文档后，乐观文档被确认并替换为服务端数据', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({ uploads: [], aiGenerated: [] });
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      act(() => {
        documentCreatedHandler?.({
          file_name: 'ai.md',
          file_path: '/workspace/proj/ai.md',
          type: 'ai_generated',
          conversation_id: 'c1',
          message_id: 'm1',
        });
      });
      await waitFor(() => expect(result.current.aiGenerated.length).toBe(1));
      expect(result.current.aiGenerated[0].summary_status).toBe('pending');

      // 服务端 record 完成，refetch 返回 ready 文档（同 file_path）
      mockFetchDocuments.mockResolvedValue({
        uploads: [],
        aiGenerated: [{
          ...makeDoc({ type: 'ai_generated' }),
          file_name: 'ai.md',
          file_path: '/workspace/proj/ai.md',
          summary_status: 'ready',
          summary: '正式摘要',
        }],
      });
      // 推进时间触发轮询
      act(() => { vi.advanceTimersByTime(5_000); });

      await waitFor(() => expect(result.current.aiGenerated[0].summary_status).toBe('ready'));
      expect(result.current.aiGenerated[0].summary).toBe('正式摘要');
      // 去重：乐观文档已被服务端数据替换，总数仍为 1
      expect(result.current.aiGenerated.length).toBe(1);
    });

    it('未确认的乐观文档在 60s 后被兜底清理', async () => {
      const { wrapper } = createWrapper();
      // 服务端始终不返回该文档，模拟 recordAIDocument 失败
      mockFetchDocuments.mockResolvedValue({ uploads: [], aiGenerated: [] });
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      act(() => {
        documentCreatedHandler?.({
          file_name: 'stuck.md',
          file_path: '/workspace/proj/stuck.md',
          type: 'ai_generated',
          conversation_id: 'c1',
          message_id: 'm1',
        });
      });
      await waitFor(() => expect(result.current.aiGenerated.length).toBe(1));

      // 推进过 60s TTL，兜底定时器应移除该乐观文档
      act(() => { vi.advanceTimersByTime(61_000); });

      expect(result.current.aiGenerated.length).toBe(0);
    });

    it('服务端确认后兜底定时器已清理，推进过 TTL 不会误删服务端数据', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({ uploads: [], aiGenerated: [] });
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalled());

      act(() => {
        documentCreatedHandler?.({
          file_name: 'ai.md',
          file_path: '/workspace/proj/ai.md',
          type: 'ai_generated',
          conversation_id: 'c1',
          message_id: 'm1',
        });
      });
      await waitFor(() => expect(result.current.aiGenerated.length).toBe(1));

      // 服务端确认（同 file_path 返回 ready）
      mockFetchDocuments.mockResolvedValue({
        uploads: [],
        aiGenerated: [{
          ...makeDoc({ type: 'ai_generated' }),
          file_name: 'ai.md',
          file_path: '/workspace/proj/ai.md',
          summary_status: 'ready',
          summary: '正式摘要',
        }],
      });
      act(() => { vi.advanceTimersByTime(5_000); });
      await waitFor(() => expect(result.current.aiGenerated[0].summary_status).toBe('ready'));

      // 推进过 TTL：确认时已 clearTimeout，孤儿定时器不会触发，服务端数据仍在
      act(() => { vi.advanceTimersByTime(61_000); });
      expect(result.current.aiGenerated.length).toBe(1);
      expect(result.current.aiGenerated[0].summary).toBe('正式摘要');
    });
  });

  // ─── 轮询 ───────────────────────────────────────────

  describe('polling', () => {
    it('有 pending 文档时启动轮询', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({ summary_status: 'pending' })],
        aiGenerated: [],
      });

      renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      // 推进 5 秒（轮询间隔 4 秒 + 缓冲），应触发第一次轮询
      act(() => { vi.advanceTimersByTime(5_000); });

      await waitFor(() => {
        expect(mockFetchDocuments.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('aiGenerated pending 也触发轮询', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [],
        aiGenerated: [makeDoc({ type: 'ai_generated', summary_status: 'pending' })],
      });

      renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      act(() => { vi.advanceTimersByTime(11_000); });

      await waitFor(() => {
        expect(mockFetchDocuments.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('所有 pending 变 ready 后轮询停止', async () => {
      const { wrapper } = createWrapper();
      // 第一次返回 pending
      mockFetchDocuments.mockResolvedValueOnce({
        uploads: [makeDoc({ summary_status: 'pending' })],
        aiGenerated: [],
      });

      // 第二次（轮询）返回 ready
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({ summary_status: 'ready' })],
        aiGenerated: [],
      });

      renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      // 触发第一次轮询 → 拿到 ready
      act(() => { vi.advanceTimersByTime(5_000); });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(2));

      // 再推进 6 秒，不应再调用（轮询已停止）
      const callsAfterStop = mockFetchDocuments.mock.calls.length;
      act(() => { vi.advanceTimersByTime(6_000); });

      expect(mockFetchDocuments.mock.calls.length).toBe(callsAfterStop);
    });

    it('轮询超过 60 秒后自动停止', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({ summary_status: 'pending' })],
        aiGenerated: [],
      });

      renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      // 推进 65 秒
      act(() => { vi.advanceTimersByTime(65_000); });

      // 应该有一些轮询调用，但不会无限增长
      const callCount = mockFetchDocuments.mock.calls.length;
      expect(callCount).toBeGreaterThan(1);

      // 再推进，不应有更多调用
      act(() => { vi.advanceTimersByTime(5_000); });
      expect(mockFetchDocuments.mock.calls.length).toBe(callCount);
    });
  });

  // ─── projectName null 保护 ───────────────────────────

  describe('projectName 为 null', () => {
    it('不调用 fetchDocuments', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({ ...EMPTY_RESPONSE });
      renderHook(() => useDocuments(null), { wrapper });

      // 等一会让 useEffect 执行
      act(() => { vi.advanceTimersByTime(100); });

      expect(mockFetchDocuments).not.toHaveBeenCalled();
    });
  });

  // ─── 本地 error 兜底 + regenerate ────────────────────

  describe('本地 error 兜底 + regenerate', () => {
    it('轮询超时后，仍 pending 的文档被标为本地 error', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({
          summary_status: 'pending',
          file_path: '/p/stuck.pdf',
          file_name: 'stuck.pdf',
        })],
        aiGenerated: [],
      });

      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      // 推进过 60s 轮询上限（setInterval 间隔 4s，需推进到 64s 那次回调才进超时分支）：
      // 超时兜底应把 pending 标为本地 error
      act(() => { vi.advanceTimersByTime(65_000); });

      await waitFor(() => {
        expect(result.current.uploads[0].summary_status).toBe('error');
      });
    });

    it('后端转 ready（手动刷新）后，本地 error 标记被清除', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({
          summary_status: 'pending',
          file_path: '/p/x.pdf',
          file_name: 'x.pdf',
        })],
        aiGenerated: [],
      });
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(mockFetchDocuments).toHaveBeenCalledTimes(1));

      act(() => { vi.advanceTimersByTime(65_000); });
      await waitFor(() => expect(result.current.uploads[0].summary_status).toBe('error'));

      // 后端转 ready，手动刷新触发 refetch
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({
          summary_status: 'ready',
          file_path: '/p/x.pdf',
          file_name: 'x.pdf',
          summary: '好了',
        })],
        aiGenerated: [],
      });
      await act(async () => { await result.current.refresh(); });

      await waitFor(() => expect(result.current.uploads[0].summary_status).toBe('ready'));
    });

    it('regenerateSummary 调用 regenerate 端点（参数正确）', async () => {
      const { wrapper } = createWrapper();
      mockFetchDocuments.mockResolvedValue({
        uploads: [makeDoc({
          summary_status: 'error',
          file_path: '/p/bad.pdf',
          file_name: 'bad.pdf',
        })],
        aiGenerated: [],
      });
      const { result } = renderHook(() => useDocuments('proj'), { wrapper });
      await waitFor(() => expect(result.current.uploads[0].summary_status).toBe('error'));

      await act(async () => {
        await result.current.regenerateSummary('/p/bad.pdf', 'bad.pdf', 'upload');
      });

      expect(mockRegenerateDocumentSummary).toHaveBeenCalledWith('proj', '/p/bad.pdf', 'bad.pdf', 'upload');
    });
  });
});
