/**
 * FileTreeItem.tsx
 *
 * Individual file tree item component with drag-and-drop support
 *
 * @module features/file-explorer/components/FileTreeItem
 */

import React from 'react';
import type { FileNode } from '../types/file-explorer.types';
import type { TFunction } from 'i18next';
import { RenameInput } from './RenameInput';
import { getContainerClassName, handleDragStart, handleDragOver, handleDrop } from './fileTreeDragHandlers';
import { handleItemClick } from './fileTreeClickHandlers';
import { getItemIcon, getNameContent, getActionButtons, getItemChildren, getLayoutComponent } from './FileTreeItemHelpers';
import { ActionButtonsOverlay } from './FileTreeLayouts';
import type { LayoutProps } from './FileTreeLayouts';

// File tree item props
export interface FileTreeItemProps {
  item: FileNode;
  level: number;
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
  renderChildren: (children: FileNode[], level: number) => React.ReactNode;
}

// File tree item with drag-and-drop
export function FileTreeItem({
  item, level, viewMode, expandedDirs, selectedFolder, renamingFile, editingName, deletingFile,
  draggingItem, dragOverItem, t, units, onToggleDirectory, onSelectFile, onSelectFolder, onRenameStart,
  onRenameChange, onRenameConfirm, onRenameCancel, onDelete, onDragStart, onDragOver, onDrop, renderChildren
}: FileTreeItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    handleItemClick(item, renamingFile, onToggleDirectory, onSelectFile, onSelectFolder, e);
  };

  const icon = getItemIcon(item, expandedDirs);
  const nameContent = getNameContent(item, renamingFile, editingName, onRenameChange, onRenameConfirm, onRenameCancel);
  const actionButtons = getActionButtons(item, renamingFile, deletingFile, onRenameStart, onDelete);
  const children = getItemChildren(item, expandedDirs, renderChildren, level);

  const layoutProps: LayoutProps = { item, level, icon, nameContent, selectedFolder, draggingItem, units, t, actionButtons, onClick: handleClick };
  const containerClassName = getContainerClassName(item, dragOverItem);
  const layoutComponent = getLayoutComponent(viewMode, layoutProps);

  return (
    <div key={item.path} className={containerClassName}
      draggable={renamingFile !== item.path}
      onDragStart={(e) => handleDragStart(item, onDragStart, e)}
      onDragOver={(e) => handleDragOver(item, onDragOver, e)}
      onDrop={(e) => handleDrop(item, onDrop, e)}>
      {layoutComponent}
      {viewMode !== 'detailed' && actionButtons && <ActionButtonsOverlay actionButtons={actionButtons} />}
      {children}
    </div>
  );
}
