/**
 * useProjectOverview Hook
 *
 * 管理案件概览（复用 SDK compact 摘要）的只读加载。
 * - projectName 变化时加载会话概览列表（sessionId + mtime）；
 * - 会话结束（claude-complete，概览刷新）时刷新列表；
 * - 点击条目时按需读取单条概览全文（不一次性全读，省带宽）。
 *
 * 仿 useProjectPrompt 范式（只读，无写入/删除）。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/shared/services/api';
import { onConversationComplete } from '../services/documentEvents';
import { logger } from '@/shared/utils/logger';

export interface OverviewEntry {
  /** 会话 ID */
  sessionId: string;
  /** 缓存文件 mtime（毫秒） */
  mtime: number;
}

interface UseProjectOverviewReturn {
  overviews: OverviewEntry[];
  loading: boolean;
  /** 已展开加载的 sessionId → 概览全文 */
  openedContents: Record<string, string>;
  /** 正在加载的 sessionId（null 表示无） */
  fileLoadingSession: string | null;
  /** 按需加载并缓存单条概览全文（已加载则跳过） */
  openOverview: (sessionId: string) => Promise<void>;
}

/**
 * 案件概览 Hook
 * @param projectName - 当前案件名（为 null 时不加载）
 */
export function useProjectOverview(projectName: string | null): UseProjectOverviewReturn {
  const [overviews, setOverviews] = useState<OverviewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [openedContents, setOpenedContents] = useState<Record<string, string>>({});
  const [fileLoadingSession, setFileLoadingSession] = useState<string | null>(null);

  // 加载请求序号：防快速切案件 / 刷新时旧响应覆盖新响应（竞态）
  const loadIdRef = useRef(0);

  const loadOverviews = useCallback(async (name: string) => {
    const myId = ++loadIdRef.current;
    setLoading(true);
    try {
      const res = await api.projectOverview.list(name);
      const result = await res.json();
      if (myId !== loadIdRef.current) return;
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Failed to load overviews');
      }
      setOverviews(result.data);
      setOpenedContents({});
    } catch (err) {
      if (myId !== loadIdRef.current) return;
      logger.error({ err, projectName: name }, 'Failed to load overviews');
      setOverviews([]);
      setOpenedContents({});
    } finally {
      if (myId === loadIdRef.current) setLoading(false);
    }
  }, []);

  // projectName 变化时加载
  useEffect(() => {
    if (!projectName) {
      setOverviews([]);
      setOpenedContents({});
      return;
    }
    loadOverviews(projectName);
  }, [projectName, loadOverviews]);

  // 会话结束刷新：概览由后端 debounce 刷新，会话完成时同步列表
  useEffect(() => {
    const unsubscribe = onConversationComplete(() => {
      if (projectName) loadOverviews(projectName);
    });
    return unsubscribe;
  }, [projectName, loadOverviews]);

  const openOverview = useCallback(async (sessionId: string) => {
    if (sessionId in openedContents) return; // 已加载
    if (!projectName) return;
    setFileLoadingSession(sessionId);
    try {
      const res = await api.projectOverview.read(projectName, sessionId);
      const result = await res.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to read overview');
      }
      setOpenedContents((prev) => ({ ...prev, [sessionId]: result.data.content ?? '' }));
    } catch (err) {
      logger.error({ err, projectName, sessionId }, 'Failed to read overview');
      setOpenedContents((prev) => ({ ...prev, [sessionId]: '' }));
    } finally {
      setFileLoadingSession(null);
    }
  }, [projectName, openedContents]);

  return { overviews, loading, openedContents, fileLoadingSession, openOverview };
}

export default useProjectOverview;
