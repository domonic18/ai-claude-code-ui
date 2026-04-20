/**
 * FileTreeItemHelpers.tsx
 *
 * Helper functions for FileTreeItem component
 *
 * @module features/file-explorer/components/FileTreeItemHelpers
 */

import React from 'react';
import { Folder, FolderOpen, File, FileCode, FileText } from 'lucide-react';
import type { FileNode } from '../types/file-explorer.types';
import type { TFunction } from 'i18next';
import { RenameInput } from './RenameInput';
import { FileTreeActionButtons } from './FileTreeActionButtons';
import type { LayoutProps } from './FileTreeLayouts';

// Get file icon based on filename extension
export function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(ext || '')) {
    return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
  }
  if (['md', 'txt', 'doc', 'pdf'].includes(ext || '')) {
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
  return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

/**
 * Get icon for file tree item
 */
export function getItemIcon(item: FileNode, expandedDirs: Set<string>): React.ReactNode {
  if (item.type === 'directory') {
    return expandedDirs.has(item.path)
      ? <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
      : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
  }
  return getFileIcon(item.name);
}

/**
 * Get name content for file tree item
 */
export function getNameContent(
  item: FileNode,
  renamingFile: string | null,
  editingName: string,
  onRenameChange: (value: string) => void,
  onRenameConfirm: () => void,
  onRenameCancel: () => void
): React.ReactNode {
  if (renamingFile === item.path) {
    return <RenameInput value={editingName} onChange={onRenameChange} onConfirm={onRenameConfirm} onCancel={onRenameCancel} width="w-32" />;
  }
  return <span className="text-sm truncate text-foreground">{item.name}</span>;
}

/**
 * Get action buttons for file tree item
 */
export function getActionButtons(
  item: FileNode,
  renamingFile: string | null,
  deletingFile: string | null,
  onRenameStart: (item: FileNode, e: React.MouseEvent) => void,
  onDelete: (item: FileNode, e: React.MouseEvent) => void
): React.ReactNode {
  if (renamingFile === item.path) return null;
  return <FileTreeActionButtons item={item} renamingFile={renamingFile} deletingFile={deletingFile} onRenameStart={onRenameStart} onDelete={onDelete} />;
}

/**
 * Get children nodes for directory item
 */
export function getItemChildren(
  item: FileNode,
  expandedDirs: Set<string>,
  renderChildren: (children: FileNode[], level: number) => React.ReactNode,
  level: number
): React.ReactNode {
  if (item.type !== 'directory' || !expandedDirs.has(item.path) || !item.children?.length) return null;
  return renderChildren(item.children, level + 1);
}

/**
 * Get layout component based on view mode
 */
export function getLayoutComponent(viewMode: 'simple' | 'detailed' | 'compact', layoutProps: LayoutProps): React.ReactNode {
  switch (viewMode) {
    case 'simple': return <SimpleLayout {...layoutProps} />;
    case 'detailed': return <DetailedLayout {...layoutProps} />;
    case 'compact': return <CompactLayout {...layoutProps} />;
    default: return null;
  }
}

// Import layout components (avoid circular dependency)
import { SimpleLayout, DetailedLayout, CompactLayout } from './FileTreeLayouts';
