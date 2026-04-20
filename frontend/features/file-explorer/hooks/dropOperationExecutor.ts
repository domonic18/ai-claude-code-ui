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
 * Validate drop operation and show appropriate error message
 * @returns true if validation passes, false otherwise
 */
function validateDropOperation(
  draggingItem: FileNode,
  targetItem: FileNode | null,
  canDrop: (source: FileNode, target: FileNode | null) => boolean,
  t: (key: string, params?: Record<string, string>) => string
): boolean {
  if (canDrop(draggingItem, targetItem)) {
    return true;
  }

  // Show appropriate error message
  if (targetItem?.path === draggingItem.path) {
    alert(t('fileExplorer.move.error.cannotMoveToSelf'));
  } else if (targetItem && targetItem.path.startsWith(draggingItem.path + '/')) {
    alert(t('fileExplorer.move.error.cannotMoveToChild'));
  }

  return false;
}

/**
 * Get confirmation message for move operation
 */
function getMoveConfirmMessage(
  draggingItem: FileNode,
  targetItem: FileNode | null,
  t: (key: string, params?: Record<string, string>) => string
): string {
  const sourceName = draggingItem.name || '未知文件';
  const targetName = targetItem?.name || '根目录';

  return targetItem
    ? t('fileExplorer.move.confirm', { sourceName, targetName })
    : t('fileExplorer.move.confirmToRoot', { sourceName });
}

/**
 * Execute move operation via API
 */
async function executeMove(
  selectedProjectName: string,
  draggingItem: FileNode,
  targetPath: string,
  fetchFiles: () => Promise<void>,
  t: (key: string, params?: Record<string, string>) => string
): Promise<void> {
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
}

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

  // Validate drop operation
  if (!validateDropOperation(draggingItem, targetItem, canDrop, t)) {
    setDraggingItem(null);
    return;
  }

  // Get target path
  const targetPath = targetItem ? extractRelativePath(targetItem.path, selectedProjectName) : '';

  // Confirm move operation
  const confirmMessage = getMoveConfirmMessage(draggingItem, targetItem, t);
  if (!confirm(confirmMessage)) {
    setDraggingItem(null);
    return;
  }

  // Execute move
  setIsMoving(true);

  try {
    await executeMove(selectedProjectName, draggingItem, targetPath, fetchFiles, t);
  } catch (error) {
    logger.error('[FileExplorer] Move error:', error);
    alert(t('fileExplorer.move.error.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
  } finally {
    setIsMoving(false);
    setDraggingItem(null);
  }
}
