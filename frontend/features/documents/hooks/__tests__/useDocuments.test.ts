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

vi.mock('@/features/documents/services/documentService', () => ({
  fetchDocuments: (...args) => mockFetchDocuments(...args),
  uploadDocument: (...args) => mockUploadDocument(...args),
  deleteDocument: (...args) => mockDeleteDocument(...args),
  updateDocumentSummary: (...args) => mockUpdateDocumentSummary(...args),
}));

// documentEvents 事件总线：保存回调引用
let documentCreatedHandler = null;

vi.mock('@/features/documents/services/documentEvents', () => ({
  onDocumentCreated: (handler) => {
    documentCreatedHandler = handler;
    return () => { documentCreatedHandler = null; };
  },
  onDocumentUploaded: () => () => {},
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
});
