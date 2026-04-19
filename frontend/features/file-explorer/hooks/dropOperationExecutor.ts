/**
 * Drop Operation Executor
 *
 * Handles the execution of drop operations for file/directory moves
 */

import { api } from '@/shared/services';
import type { FileNode } from '../types/file-explorer.types';
import { extractRelativePath } from '../utils/fileTreeHelpers';
import { logger } from '@/shared/utils/logger';

/**
 * Execute drop operation with validation and API call
 *
 * @param options - Drop operation options
 */
export async function executeDropOperation(options: {
  draggingItem: FileNode;
  targetItem: FileNode | null;
  selectedProjectName: string;
  canDrop: (source: FileNode, target: FileNode | null) => boolean;
  t: (key: string, params?: Record<string, string>) => string;
  fetchFiles: () => Promise<void>;
  setIsMoving: (moving: boolean) => void;
  setDraggingItem: (item: FileNode | null) => void;
}): Promise<void> {
  const {
    draggingItem,
    targetItem,
    selectedProjectName,
    canDrop,
    t,
    fetchFiles,
    setIsMoving,
    setDraggingItem,
  } = options;

  if (!canDrop(draggingItem, targetItem)) {
    if (targetItem?.path === draggingItem.path) {
      alert(t('fileExplorer.move.error.cannotMoveToSelf'));
    } else if (targetItem && targetItem.path.startsWith(draggingItem.path + '/')) {
      alert(t('fileExplorer.move.error.cannotMoveToChild'));
    }
    setDraggingItem(null);
    return;
  }

  let targetPath = '';
  if (targetItem) {
    targetPath = extractRelativePath(targetItem.path, selectedProjectName);
  }

  const sourceName = draggingItem.name || '未知文件';
  const targetName = targetItem?.name || '根目录';

  const confirmMessage = targetItem
    ? t('fileExplorer.move.confirm', { sourceName, targetName })
    : t('fileExplorer.move.confirmToRoot', { sourceName });

  if (!confirm(confirmMessage)) {
    setDraggingItem(null);
    return;
  }

  setIsMoving(true);

  try {
    const sourcePath = extractRelativePath(draggingItem.path, selectedProjectName);
    const response = await api.moveFile(selectedProjectName, sourcePath, targetPath);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message?.includes('already exists')) {
        throw new Error(t('fileExplorer.move.error.targetExists'));
      }
      throw new Error(errorData.error || errorData.message || 'Move failed');
    }

    await fetchFiles();
  } catch (error) {
    logger.error('[FileExplorer] Move error:', error);
    alert(t('fileExplorer.move.error.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
  } finally {
    setIsMoving(false);
    setDraggingItem(null);
  }
}
