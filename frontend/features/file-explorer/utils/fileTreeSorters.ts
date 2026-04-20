/**
 * File Tree Sorting Utilities
 *
 * File sorting functions and icon configuration
 */

import type { FileNode } from '../types';

/** File type icon configuration — data-driven replacement for if-else chains */
export const FILE_ICON_MAP: Record<string, { icon: string; color: string; isImage?: boolean; isPdf?: boolean; isArchive?: boolean }> = {
  // Images
  '.png':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.jpg':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.jpeg': { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.gif':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.svg':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.webp': { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.ico':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  '.bmp':  { icon: 'Image', color: 'text-purple-500', isImage: true },
  // PDF
  '.pdf': { icon: 'FileText', color: 'text-red-500', isPdf: true },
  // Archives
  '.zip': { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  '.tar': { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  '.gz':  { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  '.rar': { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  '.7z':  { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  '.bz2': { icon: 'Archive', color: 'text-yellow-600', isArchive: true },
  // Code
  '.js':   { icon: 'FileCode', color: 'text-blue-500' },
  '.jsx':  { icon: 'FileCode', color: 'text-blue-500' },
  '.ts':   { icon: 'FileCode', color: 'text-blue-500' },
  '.tsx':  { icon: 'FileCode', color: 'text-blue-500' },
  '.py':   { icon: 'FileCode', color: 'text-blue-500' },
  '.rb':   { icon: 'FileCode', color: 'text-blue-500' },
  '.go':   { icon: 'FileCode', color: 'text-blue-500' },
  '.rs':   { icon: 'FileCode', color: 'text-blue-500' },
  '.java': { icon: 'FileCode', color: 'text-blue-500' },
  '.c':    { icon: 'FileCode', color: 'text-blue-500' },
  '.cpp':  { icon: 'FileCode', color: 'text-blue-500' },
  '.h':    { icon: 'FileCode', color: 'text-blue-500' },
  '.cs':   { icon: 'FileCode', color: 'text-blue-500' },
  // Markdown
  '.md': { icon: 'FileText', color: 'text-blue-400' },
  // Data
  '.json': { icon: 'FileText', color: 'text-yellow-500' },
  '.yaml': { icon: 'FileText', color: 'text-yellow-500' },
  '.yml':  { icon: 'FileText', color: 'text-yellow-500' },
  '.xml':  { icon: 'FileText', color: 'text-yellow-500' },
};

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
