/**
 * FileTreeLayouts.tsx
 *
 * Layout components for different file tree view modes
 *
 * @module features/file-explorer/components/FileTreeLayouts
 */

import React from 'react';
import type { FileNode } from '../types/file-explorer.types';
import type { TFunction } from 'i18next';
import { formatFileSize, formatRelativeTime } from '../utils/fileFormatters';

// Layout props interface
export interface LayoutProps {
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
export function SimpleLayout({ item, level, icon, nameContent, selectedFolder, draggingItem, onClick }: LayoutProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 p-2 pr-16 cursor-pointer rounded-md hover:bg-accent ${selectedFolder?.path === item.path ? 'bg-accent/50' : ''} ${draggingItem?.path === item.path ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${level * 16 + 12}px` }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">{icon}{nameContent}</div>
    </div>
  );
}

// Detailed layout
export function DetailedLayout({ item, level, icon, nameContent, selectedFolder, draggingItem, units, t, actionButtons, onClick }: LayoutProps) {
  return (
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
}

// Compact layout
export function CompactLayout({ item, level, icon, nameContent, selectedFolder, draggingItem, units, onClick }: LayoutProps) {
  return (
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
}

// Action buttons overlay
export function ActionButtonsOverlay({ actionButtons }: { actionButtons: React.ReactNode }) {
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity bg-background/80 rounded-md px-1">
      {actionButtons}
    </div>
  );
}
