/**
 * useExtensionsApi - Custom hook for extension API operations
 *
 * @module features/admin/components/extensions/useExtensionsApi
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';
import type { ExtensionsData, SyncResults } from './types';

/**
 * 扩展管理数据 Hook
 * 封装 GET /api/extensions 获取扩展列表和 POST /api/extensions/sync-all 同步到所有用户两个 API 调用
 * @returns 扩展数据、加载状态、同步状态、错误信息和操作方法
 */
export function useExtensionsApi() {
  // 扩展列表数据，初始为 null 表示尚未加载
  const [extensions, setExtensions] = useState<ExtensionsData | null>(null);
  // 首次加载态
  const [loading, setLoading] = useState(true);
  // 同步操作进行态
  const [syncing, setSyncing] = useState(false);
  // 最近一次同步的结果（成功/失败用户数）
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  // 错误信息，加载或同步失败时设置
  const [error, setError] = useState<string | null>(null);

  /**
   * 从后端获取所有可用扩展列表
   * 请求 GET /api/extensions，成功后写入 extensions 状态
   */
  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extensions');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch extensions');
      }

      setExtensions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to fetch extensions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 将扩展同步到所有用户目录
   * 请求 POST /api/extensions/sync-all，overwriteUserFiles 为 true 时覆盖用户已有文件
   * 同步完成后自动刷新扩展列表
   * @param overwriteUserFiles - 是否覆盖用户的已有扩展文件
   */
  const syncToAll = useCallback(async (overwriteUserFiles = false) => {
    setSyncing(true);
    setError(null);
    setSyncResults(null);

    try {
      const response = await fetch('/api/extensions/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwriteUserFiles })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync extensions');
      }

      setSyncResults(data.data);
      // 同步完成后重新拉取扩展列表以反映最新状态
      await fetchExtensions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to sync extensions:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchExtensions]);

  // 组件挂载时自动拉取扩展列表
  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  return { extensions, loading, syncing, syncResults, error, fetchExtensions, syncToAll };
}
