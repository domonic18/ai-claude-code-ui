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

/**
 * Get file icon based on filename extension
 *
 * @param {string} filename - The filename to get icon for
 * @returns {React.ReactNode} File icon component
 */
function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
  const docExtensions = ['md', 'txt', 'doc', 'pdf'];

  if (codeExtensions.includes(ext || '')) {
    return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
  } else if (docExtensions.includes(ext || '')) {
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
  return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

/**
 * File tree views component
 * Supports simple, detailed, and compact view modes
 *
 * @param {FileTreeViewsProps} props - Component props
 * @returns {JSX.Element} File tree views component
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
  if (viewMode === 'simple') {
    return (
      <div className="space-y-1">
        {renderSimpleView(items, 0)}
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="space-y-1">
        {renderCompactView(items, 0)}
      </div>
    );
  }

  return (
    <div>
      {renderDetailedView(items, 0)}
    </div>
  );

  function renderSimpleView(nodes: FileNode[], level: number): React.ReactNode {
    return nodes.map((item) => (
      <div
        key={item.path}
        className={`
          select-none group/file rounded-md relative
          ${dragOverItem?.path === item.path && item.type === 'directory' ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
        `}
        draggable={renamingFile !== item.path}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(item, e);
        }}
        onDragOver={(e) => {
          e.stopPropagation();
          onDragOver(item, e);
        }}
        onDrop={(e) => onDrop(item, e)}
      >
        {/* 主点击区域 */}
        <div
          className={`
            flex items-center justify-between gap-2 p-2 pr-16 cursor-pointer rounded-md
            hover:bg-accent
            ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''}
            ${draggingItem?.path === item.path ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (renamingFile === item.path) return;
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              onSelectFolder(item, e);
              return;
            }
            if (item.type === 'directory') {
              onToggleDirectory(item.path);
            } else {
              onSelectFile(item);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            {renamingFile === item.path ? (
              <RenameInput
                value={editingName}
                onChange={onRenameChange}
                onConfirm={onRenameConfirm}
                onCancel={onRenameCancel}
                width="w-32"
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>
        </div>

        {/* 操作按钮 - 绝对定位，避免嵌套点击问题 */}
        {renamingFile !== item.path && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity bg-background/80 rounded-md px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRenameStart(item, e);
              }}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item, e);
              }}
              disabled={deletingFile === item.path}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* 子目录 */}
        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          item.children.length > 0 && (
            <div>{renderSimpleView(item.children, level + 1)}</div>
          )}
      </div>
    ));
  }

  function renderDetailedView(nodes: FileNode[], level: number): React.ReactNode {
    return nodes.map((item) => (
      <div
        key={item.path}
        className={`
          select-none group/file rounded-md relative
          ${dragOverItem?.path === item.path && item.type === 'directory' ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
        `}
        draggable={renamingFile !== item.path}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(item, e);
        }}
        onDragOver={(e) => {
          e.stopPropagation();
          onDragOver(item, e);
        }}
        onDrop={(e) => onDrop(item, e)}
      >
        {/* 主点击区域 */}
        <div
          className={`
            grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center
            ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''}
            ${draggingItem?.path === item.path ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (renamingFile === item.path) return;
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              onSelectFolder(item, e);
              return;
            }
            if (item.type === 'directory') {
              onToggleDirectory(item.path);
            } else {
              onSelectFile(item);
            }
          }}
        >
          <div className="col-span-4 flex items-center gap-2 min-w-0">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            {renamingFile === item.path ? (
              <RenameInput
                value={editingName}
                onChange={onRenameChange}
                onConfirm={onRenameConfirm}
                onCancel={onRenameCancel}
                width="w-32"
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            {item.type === 'file' ? formatFileSize(item.size, units) : '-'}
          </div>
          <div className="col-span-3 text-sm text-muted-foreground">
            {formatRelativeTime(item.modified, t)}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground font-mono">
            {item.permissionsRwx || '-'}
          </div>
          <div className="col-span-1 flex justify-end gap-1">
            {renamingFile !== item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameStart(item, e);
                  }}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item, e);
                  }}
                  disabled={deletingFile === item.path}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          renderDetailedView(item.children, level + 1)}
      </div>
    ));
  }

  function renderCompactView(nodes: FileNode[], level: number): React.ReactNode {
    return nodes.map((item) => (
      <div
        key={item.path}
        className={`
          select-none group/file rounded-md relative
          ${dragOverItem?.path === item.path && item.type === 'directory' ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
        `}
        draggable={renamingFile !== item.path}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(item, e);
        }}
        onDragOver={(e) => {
          e.stopPropagation();
          onDragOver(item, e);
        }}
        onDrop={(e) => onDrop(item, e)}
      >
        {/* 主点击区域 */}
        <div
          className={`
            flex items-center justify-between p-2 hover:bg-accent cursor-pointer
            ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''}
            ${draggingItem?.path === item.path ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (renamingFile === item.path) return;
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              onSelectFolder(item, e);
              return;
            }
            if (item.type === 'directory') {
              onToggleDirectory(item.path);
            } else {
              onSelectFile(item);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-20">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            {renamingFile === item.path ? (
              <RenameInput
                value={editingName}
                onChange={onRenameChange}
                onConfirm={onRenameConfirm}
                onCancel={onRenameCancel}
                width="w-32"
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <>
                <span>{formatFileSize(item.size, units)}</span>
                <span className="font-mono">{item.permissionsRwx}</span>
              </>
            )}
          </div>
        </div>

        {/* 操作按钮 - 绝对定位，避免嵌套点击问题 */}
        {renamingFile !== item.path && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity bg-background/80 rounded-md px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRenameStart(item, e);
              }}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item, e);
              }}
              disabled={deletingFile === item.path}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}

        {item.type === 'directory' &&
          expandedDirs.has(item.path) &&
          item.children &&
          renderCompactView(item.children, level + 1)}
      </div>
    ));
  }
}

export default FileTreeViews;
