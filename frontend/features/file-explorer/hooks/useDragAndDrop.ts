import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/services';
import type { FileNode } from '../types/file-explorer.types';
import { extractRelativePath } from '../utils/fileTreeHelpers';

interface UseDragAndDropProps {
  selectedProject: { name: string; path: string };
  files: FileNode[];
  fetchFiles: () => Promise<void>;
}

interface UseDragAndDropReturn {
  draggingItem: FileNode | null;
  dragOverItem: FileNode | null;
  isDragOverRoot: boolean;
  isMoving: boolean;
  handleDragStart: (item: FileNode, e: React.DragEvent) => void;
  handleDragOver: (item: FileNode | null, e: React.DragEvent) => void;
  handleScrollAreaDragLeave: (e: React.DragEvent) => void;
  handleDrop: (targetItem: FileNode | null, e: React.DragEvent) => Promise<void>;
}

/**
 * 拖拽操作 Hook
 * 处理文件/文件夹的拖拽移动
 */
export function useDragAndDrop({
  selectedProject,
  files,
  fetchFiles
}: UseDragAndDropProps): UseDragAndDropReturn {
  const { t } = useTranslation();
  const [draggingItem, setDraggingItem] = useState<FileNode | null>(null);
  const [dragOverItem, setDragOverItem] = useState<FileNode | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  /**
   * 检查是否可以放置
   */
  const canDrop = useCallback((source: FileNode, target: FileNode | null): boolean => {
    if (!target) {
      // 拖拽到根目录 - 总是允许，后端会处理已经在根目录的情况
      return true;
    }
    if (target.type !== 'directory') return false;
    if (source.path === target.path) return false;
    if (target.path.startsWith(source.path + '/')) return false;
    return true;
  }, []);

  /**
   * 处理拖拽开始
   */
  const handleDragStart = useCallback((item: FileNode, e: React.DragEvent) => {
    setDraggingItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
  }, []);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback((item: FileNode | null, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggingItem) return;

    if (item === null) {
      setIsDragOverRoot(true);
      setDragOverItem(null);
    } else {
      setDragOverItem(item);
      setIsDragOverRoot(false);
    }
  }, [draggingItem]);

  /**
   * 处理拖拽离开滚动区域
   */
  const handleScrollAreaDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOverRoot(false);
      setDragOverItem(null);
    }
  }, []);

  /**
   * 处理放置
   */
  const handleDrop = useCallback(async (targetItem: FileNode | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragOverItem(null);
    setIsDragOverRoot(false);

    if (!draggingItem) return;

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
      targetPath = extractRelativePath(targetItem.path, selectedProject.name);
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
      const sourcePath = extractRelativePath(draggingItem.path, selectedProject.name);
      const response = await api.moveFile(selectedProject.name, sourcePath, targetPath);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.message?.includes('already exists')) {
          throw new Error(t('fileExplorer.move.error.targetExists'));
        }
        throw new Error(errorData.error || errorData.message || 'Move failed');
      }

      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] Move error:', error);
      alert(t('fileExplorer.move.error.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setIsMoving(false);
      setDraggingItem(null);
    }
  }, [draggingItem, canDrop, selectedProject.name, t, fetchFiles]);

  return {
    draggingItem,
    dragOverItem,
    isDragOverRoot,
    isMoving,
    handleDragStart,
    handleDragOver,
    handleScrollAreaDragLeave,
    handleDrop
  };
}

export default useDragAndDrop;
