/**
 * Drag and Drop Helpers
 *
 * Helper functions for drag and drop operations
 */

import type { FileNode } from '../types/file-explorer.types';
import { useCallback } from 'react';

/**
 * Check if source can be dropped on target
 *
 * @param source - File node being dragged
 * @param target - File node being dropped on (null for root)
 * @returns Whether drop is allowed
 */
export function canDrop(source: FileNode, target: FileNode | null): boolean {
  if (!target) {
    // 拖拽到根目录 - 总是允许，后端会处理已经在根目录的情况
    return true;
  }
  if (target.type !== 'directory') return false;
  if (source.path === target.path) return false;
  if (target.path.startsWith(source.path + '/')) return false;
  return true;
}

/**
 * Create drag start handler
 *
 * @param setDraggingItem - State setter for dragging item
 * @returns Drag start event handler
 */
export function createDragStartHandler(
  setDraggingItem: React.Dispatch<React.SetStateAction<FileNode | null>>
) {
  return useCallback((item: FileNode, e: React.DragEvent) => {
    setDraggingItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
  }, [setDraggingItem]);
}

/**
 * Create drag over handler
 *
 * @param draggingItem - Currently dragging item
 * @param setDragOverItem - State setter for drag over item
 * @param setIsDragOverRoot - State setter for root drag over state
 * @returns Drag over event handler
 */
export function createDragOverHandler(
  draggingItem: FileNode | null,
  setDragOverItem: React.Dispatch<React.SetStateAction<FileNode | null>>,
  setIsDragOverRoot: React.Dispatch<React.SetStateAction<boolean>>
) {
  return useCallback((item: FileNode | null, e: React.DragEvent) => {
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
  }, [draggingItem, setDragOverItem, setIsDragOverRoot]);
}

/**
 * Create drag leave handler
 *
 * @param setIsDragOverRoot - State setter for root drag over state
 * @param setDragOverItem - State setter for drag over item
 * @returns Drag leave event handler
 */
export function createDragLeaveHandler(
  setIsDragOverRoot: React.Dispatch<React.SetStateAction<boolean>>,
  setDragOverItem: React.Dispatch<React.SetStateAction<FileNode | null>>
) {
  return useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOverRoot(false);
      setDragOverItem(null);
    }
  }, [setIsDragOverRoot, setDragOverItem]);
}
