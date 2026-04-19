/**
 * FileReferenceMenu Component
 *
 * Displays file reference suggestions dropdown.
 * Provides keyboard navigation and file selection.
 *
 * Features:
 * - File search/filtering
 * - Keyboard navigation (arrows + Enter)
 * - File type icons
 * - Relative path display
 */

import React, { useEffect, useRef } from 'react';
import type { FileReference } from '../hooks/useFileReferences';

interface FileReferenceMenuProps {
  /** Filtered files to display */
  files: FileReference[];
  /** Is menu visible */
  isOpen: boolean;
  /** Currently selected index */
  selectedIndex: number;
  /** File selection callback */
  onSelect: (file: FileReference, index: number, isHover?: boolean) => void;
  /** Close menu callback */
  onClose: () => void;
  /** Menu position */
  position: { top: number; left: number; bottom?: number };
  /** Search query */
  query?: string;
  /** Whether files are loading */
  isLoading?: boolean;
}

/**
 * Get file icon color based on extension
 */
function getFileIconColor(extension: string): string {
  const colorMap: Record<string, string> = {
    'js': 'text-yellow-500',
    'jsx': 'text-yellow-500',
    'ts': 'text-blue-500',
    'tsx': 'text-blue-500',
    'py': 'text-green-500',
    'rs': 'text-orange-500',
    'go': 'text-cyan-500',
    'java': 'text-red-500',
    'css': 'text-purple-500',
    'html': 'text-orange-500',
    'json': 'text-gray-500',
    'md': 'text-gray-400',
    'txt': 'text-gray-400',
  };

  return colorMap[extension] || 'text-gray-400';
}

/**
 * Get file icon based on extension
 */
function getFileIcon(file: FileReference) {
  if (file.type === 'directory') {
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    );
  }

  const ext = file.extension?.toLowerCase() || '';
  const colorClass = getFileIconColor(ext);

  return (
    <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

/**
 * Calculate responsive positioning for menu
 */
function getMenuPosition(position: { top: number; left: number; bottom?: number }) {
  const isMobile = window.innerWidth < 640;
  const viewportHeight = window.innerHeight;
  const menuHeight = 300;

  if (isMobile) {
    const inputBottom = position.bottom || 90;
    return {
      position: 'fixed',
      bottom: `${inputBottom}px`,
      left: '16px',
      right: '16px',
      width: 'auto',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(50vh, 300px)'
    } as const;
  }

  return {
    position: 'fixed',
    top: `${Math.max(16, Math.min(position.top, viewportHeight - menuHeight - 16))}px`,
    left: `${position.left}px`,
    width: 'min(400px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: '300px'
  } as const;
}

/**
 * FileListItem sub-component for rendering each file item
 */
interface FileListItemProps {
  file: FileReference;
  index: number;
  isSelected: boolean;
  onSelect: (file: FileReference, index: number, isHover?: boolean) => void;
  selectedItemRef: React.RefObject<HTMLDivElement>;
}

function FileListItem({ file, index, isSelected, onSelect, selectedItemRef }: FileListItemProps) {
  return (
    <div
      key={file.path}
      ref={isSelected ? selectedItemRef : null}
      className={`
        px-3 py-2 cursor-pointer flex items-center gap-2
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }
      `}
      onClick={() => onSelect(file, index)}
      onMouseEnter={() => onSelect(file, index, true)}
    >
      {/* File icon */}
      <div className="flex-shrink-0">
        {getFileIcon(file)}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {file.name}
        </p>
        {file.relativePath !== file.name && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {file.relativePath}
          </p>
        )}
      </div>

      {isSelected && (
        <span className="text-gray-400 dark:text-gray-500">
          ↵
        </span>
      )}
    </div>
  );
}

/**
 * Render menu state message (loading or empty)
 */
function MenuStateMessage({ message, menuPosition }: { message: string; menuPosition: ReturnType<typeof getMenuPosition> }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-4" style={menuPosition}>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{message}</p>
    </div>
  );
}

/**
 * FileReferenceMenu Component
 */
export function FileReferenceMenu({
  files,
  isOpen,
  selectedIndex,
  onSelect,
  onClose,
  position,
  query = '',
  isLoading = false,
}: FileReferenceMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const menuPosition = getMenuPosition(position);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedItemRef.current && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const itemRect = selectedItemRef.current.getBoundingClientRect();
      if (itemRect.bottom > menuRect.bottom || itemRect.top < menuRect.top) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;
  if (isLoading) return <MenuStateMessage message="Loading files..." menuPosition={menuPosition} />;
  if (files.length === 0) {
    return <MenuStateMessage message={query ? `No files matching "${query}"` : 'No files available'} menuPosition={menuPosition} />;
  }

  return (
    <div ref={menuRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden" style={menuPosition}>
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Files {query && `matching "${query}"`}</p>
      </div>
      <div className="max-h-[300px] overflow-y-auto py-1">
        {files.map((file, index) => (
          <FileListItem key={file.path} file={file} index={index} isSelected={index === selectedIndex} onSelect={onSelect} selectedItemRef={selectedItemRef} />
        ))}
      </div>
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">Use arrow keys to navigate, Enter to select</p>
      </div>
    </div>
  );
}

export default FileReferenceMenu;
