/**
 * FileTreeViews.tsx
 *
 * File tree views component supporting simple, detailed, and compact view modes
 *
 * @module features/file-explorer/components/FileTreeViews
 */

import React from 'react';
import type { FileNode } from '../types/file-explorer.types';
import type { TFunction } from 'i18next';
import { FileTreeItem } from './FileTreeItem';

// FileTreeViewsProps 的类型定义
/**
 * Props for FileTreeViews component
 */
export interface FileTreeViewsProps {
  items: FileNode[];
  viewMode: 'simple' | 'detailed' | 'compact';
  expandedDirs: Set<string>;
  selectedFolder: FileNode | null;
  renamingFile: string | null;
  editingName: string;
  deletingFile: string | null;
  draggingItem: FileNode | null;
  dragOverItem: FileNode | null;
  t: TFunction;
  units: string[];
  onToggleDirectory: (path: string) => void;
  onSelectFile: (item: FileNode) => void;
  onSelectFolder: (item: FileNode, e: React.MouseEvent) => void;
  onRenameStart: (item: FileNode, e: React.MouseEvent) => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDelete: (item: FileNode, e: React.MouseEvent) => void;
  onDragStart: (item: FileNode, e: React.DragEvent) => void;
  onDragOver: (item: FileNode | null, e: React.DragEvent) => void;
  onDrop: (item: FileNode | null, e: React.DragEvent) => void;
}

// 由父组件调用，React 组件或常量：FileTreeViews
/**
 * File tree views component - Supports simple, detailed, and compact view modes
 */
export function FileTreeViews({
  items,
  viewMode,
  expandedDirs,
  selectedFolder,
  renamingFile,
  editingName,
  deletingFile,
  draggingItem,
  dragOverItem,
  t,
  units,
  onToggleDirectory,
  onSelectFile,
  onSelectFolder,
  onRenameStart,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}: FileTreeViewsProps) {
  const renderItems = (nodes: FileNode[], level: number): React.ReactNode => {
    return nodes.map((item) => (
      <FileTreeItem
        key={item.path}
        item={item}
        level={level}
        viewMode={viewMode}
        expandedDirs={expandedDirs}
        selectedFolder={selectedFolder}
        renamingFile={renamingFile}
        editingName={editingName}
        deletingFile={deletingFile}
        draggingItem={draggingItem}
        dragOverItem={dragOverItem}
        t={t}
        units={units}
        onToggleDirectory={onToggleDirectory}
        onSelectFile={onSelectFile}
        onSelectFolder={onSelectFolder}
        onRenameStart={onRenameStart}
        onRenameChange={onRenameChange}
        onRenameConfirm={onRenameConfirm}
        onRenameCancel={onRenameCancel}
        onDelete={onDelete}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        renderChildren={renderItems}
      />
    ));
  };

  if (viewMode === 'simple' || viewMode === 'compact') {
    return (
      <div className="space-y-1">
        {renderItems(items, 0)}
      </div>
    );
  }

  return (
    <div>
      {renderItems(items, 0)}
    </div>
  );
}

// Re-export FileTreeItem and related components for backward compatibility
export { FileTreeItem } from './FileTreeItem';
export type { FileTreeItemProps } from './FileTreeItem';
export { SimpleLayout, DetailedLayout, CompactLayout, ActionButtonsOverlay, type LayoutProps } from './FileTreeLayouts';
export { FileTreeActionButtons, type FileTreeActionButtonsProps } from './FileTreeActionButtons';

export default FileTreeViews;
