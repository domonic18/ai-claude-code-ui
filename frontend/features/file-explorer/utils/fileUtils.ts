/**
 * File Explorer Utilities
 *
 * Utility functions for file operations and formatting.
 */

import type { FileNode, FileType } from '../types';

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date as relative time
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';

  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;

  return past.toLocaleDateString();
}

/**
 * Format date to localized string
 */
export function formatDate(date: string | Date | null | undefined, format: 'short' | 'long' | 'full' = 'short'): string {
  if (!date) return '-';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { year: 'numeric', month: 'numeric', day: 'numeric' }
      : format === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };

  return dateObj.toLocaleDateString(undefined, options);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(idx) : '';
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  return path.split('/').pop() || '';
}

/**
 * Get directory path from file path
 */
export function getDirectoryPath(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Get parent directory path
 */
export function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '/');
}

/**
 * Check if path is a directory
 */
export function isDirectory(path: string): boolean {
  return path.endsWith('/');
}

/**
 * Check if file is hidden (starts with dot)
 */
export function isHiddenFile(fileName: string): boolean {
  return fileName.startsWith('.');
}

/**
 * Get file icon info based on extension
 */
export function getFileIconInfo(fileName: string): {
  icon: string;
  color: string;
  isImage: boolean;
  isPdf: boolean;
  isArchive: boolean;
} {
  const ext = getFileExtension(fileName).toLowerCase();

  // Images
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
  if (imageExts.includes(ext)) {
    return { icon: 'Image', color: 'text-purple-500', isImage: true, isPdf: false, isArchive: false };
  }

  // PDF
  if (ext === '.pdf') {
    return { icon: 'FileText', color: 'text-red-500', isImage: false, isPdf: true, isArchive: false };
  }

  // Archives
  const archiveExts = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'];
  if (archiveExts.includes(ext)) {
    return { icon: 'Archive', color: 'text-yellow-600', isImage: false, isPdf: false, isArchive: true };
  }

  // Code files
  const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.cs'];
  if (codeExts.includes(ext)) {
    return { icon: 'FileCode', color: 'text-blue-500', isImage: false, isPdf: false, isArchive: false };
  }

  // Markdown
  if (ext === '.md') {
    return { icon: 'FileText', color: 'text-blue-400', isImage: false, isPdf: false, isArchive: false };
  }

  // JSON/YAML
  if (['.json', '.yaml', '.yml', '.xml'].includes(ext)) {
    return { icon: 'FileText', color: 'text-yellow-500', isImage: false, isPdf: false, isArchive: false };
  }

  // Default
  return { icon: 'File', color: 'text-gray-500', isImage: false, isPdf: false, isArchive: false };
}

/**
 * Determine file type from name/extension
 */
export function getFileType(fileName: string): FileType {
  if (fileName.endsWith('/')) return 'directory';

  const ext = getFileExtension(fileName).toLowerCase();

  // Check for known file types
  const typeMap: Record<string, FileType> = {
    // Images
    '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.gif': 'file', '.svg': 'file',
    // Documents
    '.md': 'file', '.txt': 'file', '.pdf': 'file',
    // Code
    '.js': 'file', '.jsx': 'file', '.ts': 'file', '.tsx': 'file',
    '.py': 'file', '.rb': 'file', '.go': 'file', '.rs': 'file',
    '.java': 'file', '.c': 'file', '.cpp': 'file', '.h': 'file',
    // Config
    '.json': 'file', '.yaml': 'file', '.yml': 'file', '.xml': 'file',
    '.toml': 'file', '.ini': 'file', '.conf': 'file',
  };

  return typeMap[ext] || 'file';
}

/**
 * Filter files by search query recursively
 */
export function filterFilesByQuery(items: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();

  return items.reduce<FileNode[]>((filtered, item) => {
    const matchesName = item.name.toLowerCase().includes(lowerQuery);
    let filteredChildren: FileNode[] = [];

    if (item.type === 'directory' && item.children) {
      filteredChildren = filterFilesByQuery(item.children, query);
    }

    // Include if name matches or directory has matching children
    if (matchesName || filteredChildren.length > 0) {
      filtered.push({
        ...item,
        children: filteredChildren.length > 0 ? filteredChildren : item.children,
      });
    }

    return filtered;
  }, []);
}

/**
 * Flatten file tree to a list of files
 */
export function flattenFileTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  function traverse(items: FileNode[]) {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

/**
 * Find node by path in file tree
 */
export function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all file paths from file tree
 */
export function getAllFilePaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];

  function traverse(items: FileNode[]) {
    for (const item of items) {
      if (item.type === 'directory' && item.children) {
        traverse(item.children);
      } else {
        paths.push(item.path);
      }
    }
  }

  traverse(nodes);
  return paths;
}

/**
 * Sort files by name (directories first)
 */
export function sortFilesByName(a: FileNode, b: FileNode): number {
  // Directories first
  if (a.type === 'directory' && b.type !== 'directory') return -1;
  if (a.type !== 'directory' && b.type === 'directory') return 1;

  // Then by name (case-insensitive)
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/**
 * Sort files by size (descending)
 */
export function sortFilesBySize(a: FileNode, b: FileNode): number {
  const aSize = a.size || 0;
  const bSize = b.size || 0;
  return bSize - aSize;
}

/**
 * Sort files by modified time (newest first)
 */
export function sortFilesByTime(a: FileNode, b: FileNode): number {
  const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
  const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
  return bTime - aTime;
}

/**
 * Validate file path
 */
export function isValidFilePath(path: string): boolean {
  // Check for null bytes
  if (path.includes('\0')) return false;

  // Check for invalid characters (basic check)
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(path)) return false;

  return true;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 255);
}

/**
 * Truncate file name with extension preserved
 */
export function truncateFileName(name: string, maxLength: number = 30): string {
  if (name.length <= maxLength) return name;

  const ext = getFileExtension(name);
  const baseName = name.slice(0, name.length - ext.length);

  const truncatedBase = baseName.slice(0, maxLength - ext.length - 3);
  return truncatedBase + '...' + ext;
}
