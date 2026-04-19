import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileNode } from '../types/file-explorer.types';
import { canDrop, createDragStartHandler, createDragOverHandler, createDragLeaveHandler } from './dragAndDropHelpers';
import { executeDropOperation } from './dropOperationExecutor';

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
   * 处理拖拽开始
   */
  const handleDragStart = createDragStartHandler(setDraggingItem);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = createDragOverHandler(draggingItem, setDragOverItem, setIsDragOverRoot);

  /**
   * 处理拖拽离开滚动区域
   */
  const handleScrollAreaDragLeave = createDragLeaveHandler(setIsDragOverRoot, setDragOverItem);

  /**
   * 处理放置
   */
  const handleDrop = useCallback(async (targetItem: FileNode | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragOverItem(null);
    setIsDragOverRoot(false);

    if (!draggingItem) return;

    await executeDropOperation({
      draggingItem,
      targetItem,
      selectedProjectName: selectedProject.name,
      canDrop,
      t,
      fetchFiles,
      setIsMoving,
      setDraggingItem,
    });
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
