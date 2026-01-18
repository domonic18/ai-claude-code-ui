/**
 * Version Upgrade Hook
 *
 * Hook for managing application version upgrades.
 */

import { useState, useCallback } from 'react';
import { authenticatedFetch } from '@/shared/services';
import type { ReleaseInfo, UpdateProgress } from '../types';
import { getSystemService } from '../services';

/**
 * Hook for version upgrade functionality
 */
export interface UseVersionUpgradeReturn {
  showVersionModal: boolean;
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseInfo: ReleaseInfo | null;
  updateProgress: UpdateProgress;
  openVersionModal: () => void;
  closeVersionModal: () => void;
  performUpdate: () => Promise<void>;
  cleanChangelog: (body: string) => string;
}

export function useVersionUpgrade(
  currentVersion: string,
  updateAvailable: boolean,
  latestVersion: string,
  releaseInfo: ReleaseInfo | null
): UseVersionUpgradeReturn {
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress>({
    isUpdating: false,
    output: '',
    error: null,
  });

  const openVersionModal = useCallback(() => {
    setShowVersionModal(true);
  }, []);

  const closeVersionModal = useCallback(() => {
    setShowVersionModal(false);
  }, []);

  const performUpdate = useCallback(async () => {
    const systemService = getSystemService();
    setUpdateProgress({ isUpdating: true, output: 'Starting update...\n', error: null });

    try {
      const result = await systemService.performUpdate((output) => {
        setUpdateProgress(prev => ({ ...prev, output: prev.output + output + '\n' }));
      });

      if (result.success) {
        setUpdateProgress(prev => ({
          ...prev,
          output: prev.output + '\n✅ Update completed successfully!\nPlease restart the server to apply changes.\n',
          isUpdating: false,
        }));
      } else {
        setUpdateProgress({
          isUpdating: false,
          output: prev => prev.output + '\n❌ Update failed: ' + (result.error || 'Unknown error') + '\n',
          error: result.error || 'Update failed',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUpdateProgress({
        isUpdating: false,
        output: prev => prev.output + '\n❌ Update failed: ' + errorMessage + '\n',
        error: errorMessage,
      });
    }
  }, []);

  const cleanChangelog = useCallback((body: string): string => {
    return getSystemService().cleanChangelog(body);
  }, []);

  return {
    showVersionModal,
    updateAvailable,
    latestVersion,
    currentVersion,
    releaseInfo,
    updateProgress,
    openVersionModal,
    closeVersionModal,
    performUpdate,
    cleanChangelog,
  };
}
