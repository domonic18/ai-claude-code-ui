/**
 * File Tree Utilities
 *
 * File tree operations and icon lookup.
 */

import type { FileNode } from '../types';
import { FILE_ICON_MAP, sortFilesByName, sortFilesBySize, sortFilesByTime } from './fileTreeSorters';

const DEFAULT_FILE_ICON = { icon: 'File', color: 'text-gray-500', isImage: false, isPdf: false, isArchive: false };

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(idx) : '';
}

/**
 * Get file icon info based on extension (data-driven lookup)
 */
export function getFileIconInfo(fileName: string): {
  icon: string;
  color: string;
  isImage: boolean;
  isPdf: boolean;
  isArchive: boolean;
} {
  const ext = getFileExtension(fileName).toLowerCase();
  const config = FILE_ICON_MAP[ext] || DEFAULT_FILE_ICON;
  return {
    icon: config.icon,
    color: config.color,
    isImage: config.isImage || false,
    isPdf: config.isPdf || false,
    isArchive: config.isArchive || false,
  };
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

export { sortFilesByName, sortFilesBySize, sortFilesByTime, FILE_ICON_MAP } from './fileTreeSorters';
