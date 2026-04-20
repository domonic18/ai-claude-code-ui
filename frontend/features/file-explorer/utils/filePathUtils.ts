/**
 * File Path Utilities
 *
 * Path manipulation and file type utilities.
 */

import type { FileType } from '../types';

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
