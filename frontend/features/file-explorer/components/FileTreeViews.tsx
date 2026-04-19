/**
 * FileTreeViews.tsx
 *
 * File tree views component supporting simple, detailed, and compact view modes
 *
 * @module features/file-explorer/components/FileTreeViews
 */

import React from 'react';
import { Folder, FolderOpen, File, FileCode, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { RenameInput } from './RenameInput';
import { Edit2, Trash2 } from 'lucide-react';
import type { FileNode } from '../types/file-explorer.types';
import { formatFileSize, formatRelativeTime } from '../utils/fileTreeHelpers';
import type { TFunction } from 'i18next';

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

// Get file icon based on filename extension
const getFileIcon = (filename: string): React.ReactNode => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(ext || '')) {
    return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
  }
  if (['md', 'txt', 'doc', 'pdf'].includes(ext || '')) {
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
  return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
};

// Layout props interface
interface LayoutProps {
  item: FileNode;
  level: number;
  icon: React.ReactNode;
  nameContent: React.ReactNode;
  selectedFolder: FileNode | null;
  draggingItem: FileNode | null;
  units?: string[];
  t?: TFunction;
  actionButtons?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
}

// Simple layout
const SimpleLayout = ({ item, level, icon, nameContent, selectedFolder, draggingItem, onClick }: LayoutProps) => (
  <div
    className={`flex items-center justify-between gap-2 p-2 pr-16 cursor-pointer rounded-md hover:bg-accent ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''} ${draggingItem?.path === item.path ? 'opacity-50' : ''}`}
    style={{ paddingLeft: `${level * 16 + 12}px` }}
    onClick={onClick}
  >
    <div className="flex items-center gap-2 min-w-0 flex-1">{icon}{nameContent}</div>
  </div>
);

// Detailed layout
const DetailedLayout = ({ item, level, icon, nameContent, selectedFolder, draggingItem, units, t, actionButtons, onClick }: LayoutProps) => (
  <div
    className={`grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''} ${draggingItem?.path === item.path ? 'opacity-50' : ''}`}
    style={{ paddingLeft: `${level * 16 + 12}px` }}
    onClick={onClick}
  >
    <div className="col-span-4 flex items-center gap-2 min-w-0">{icon}{nameContent}</div>
    <div className="col-span-2 text-sm text-muted-foreground">{item.type === 'file' ? formatFileSize(item.size, units) : '-'}</div>
    <div className="col-span-3 text-sm text-muted-foreground">{formatRelativeTime(item.modified, t)}</div>
    <div className="col-span-2 text-sm text-muted-foreground font-mono">{item.permissionsRwx || '-'}</div>
    <div className="col-span-1 flex justify-end gap-1">{actionButtons}</div>
  </div>
);

// Compact layout
const CompactLayout = ({ item, level, icon, nameContent, selectedFolder, draggingItem, units, onClick }: LayoutProps) => (
  <div
    className={`flex items-center justify-between p-2 hover:bg-accent cursor-pointer ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''} ${draggingItem?.path === item.path ? 'opacity-50' : ''}`}
    style={{ paddingLeft: `${level * 16 + 12}px` }}
    onClick={onClick}
  >
    <div className="flex items-center gap-2 min-w-0 flex-1 pr-20">{icon}{nameContent}</div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {item.type === 'file' && (
        <>
          <span>{formatFileSize(item.size, units)}</span>
          <span className="font-mono">{item.permissionsRwx}</span>
        </>
      )}
    </div>
  </div>
);

// Action buttons overlay
const ActionButtonsOverlay = ({ actionButtons }: { actionButtons: React.ReactNode }) => (
  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity bg-background/80 rounded-md px-1">
    {actionButtons}
  </div>
);

// Action buttons for rename and delete
const FileTreeActionButtons = ({ item, renamingFile, deletingFile, onRenameStart, onDelete }: {
  item: FileNode;
  renamingFile: string | null;
  deletingFile: string | null;
  onRenameStart: (item: FileNode, e: React.MouseEvent) => void;
  onDelete: (item: FileNode, e: React.MouseEvent) => void;
}) => {
  if (renamingFile === item.path) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground" onClick={(e) => { e.stopPropagation(); onRenameStart(item, e); }}>
        <Edit2 className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); onDelete(item, e); }} disabled={deletingFile === item.path}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </>
  );
};

// File tree item props
interface FileTreeItemProps {
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
function FileTreeItem({
  item, level, viewMode, expandedDirs, selectedFolder, renamingFile, editingName, deletingFile,
  draggingItem, dragOverItem, t, units, onToggleDirectory, onSelectFile, onSelectFolder, onRenameStart,
  onRenameChange, onRenameConfirm, onRenameCancel, onDelete, onDragStart, onDragOver, onDrop, renderChildren
}: FileTreeItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (renamingFile === item.path) return;
    if ((e.ctrlKey || e.metaKey) && item.type === 'directory') { onSelectFolder(item, e); return; }
    item.type === 'directory' ? onToggleDirectory(item.path) : onSelectFile(item);
  };

  const icon = item.type === 'directory' ? (expandedDirs.has(item.path) ? <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />) : getFileIcon(item.name);
  const nameContent = renamingFile === item.path ? <RenameInput value={editingName} onChange={onRenameChange} onConfirm={onRenameConfirm} onCancel={onRenameCancel} width="w-32" /> : <span className="text-sm truncate text-foreground">{item.name}</span>;
  const actionButtons = renamingFile !== item.path ? <FileTreeActionButtons item={item} renamingFile={renamingFile} deletingFile={deletingFile} onRenameStart={onRenameStart} onDelete={onDelete} /> : null;
  const children = item.type === 'directory' && expandedDirs.has(item.path) && item.children?.length ? renderChildren(item.children, level + 1) : null;
  const layoutProps = { item, level, icon, nameContent, selectedFolder, draggingItem, units, t, actionButtons, onClick: handleClick };

  return (
    <div key={item.path} className={`select-none group/file rounded-md relative ${dragOverItem?.path === item.path && item.type === 'directory' ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}`}
      draggable={renamingFile !== item.path} onDragStart={(e) => { e.stopPropagation(); onDragStart(item, e); }} onDragOver={(e) => { e.stopPropagation(); onDragOver(item, e); }} onDrop={(e) => onDrop(item, e)}>
      {viewMode === 'simple' && <SimpleLayout {...layoutProps} />}
      {viewMode === 'detailed' && <DetailedLayout {...layoutProps} />}
      {viewMode === 'compact' && <CompactLayout {...layoutProps} />}
      {viewMode !== 'detailed' && actionButtons && <ActionButtonsOverlay actionButtons={actionButtons} />}
      {children}
    </div>
  );
}

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

export default FileTreeViews;
