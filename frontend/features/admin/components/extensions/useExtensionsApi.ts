/**
 * useExtensionsApi - Custom hook for extension API operations
 *
 * @module features/admin/components/extensions/useExtensionsApi
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';
import type { ExtensionsData, SyncResults } from './types';

// 由组件调用，自定义 Hook：useExtensionsApi
/**
 * Manages extension data fetching and sync operations
 * @returns State and handlers for extension management
 */
export function useExtensionsApi() {
  const [extensions, setExtensions] = useState<ExtensionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Fetch all available extensions from API */
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

  /** Sync extensions to all users */
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
      await fetchExtensions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to sync extensions:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchExtensions]);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  return { extensions, loading, syncing, syncResults, error, fetchExtensions, syncToAll };
}
