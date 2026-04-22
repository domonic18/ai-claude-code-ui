/**
 * fileTreeHelpers.ts
 *
 * 文件树辅助函数
 * 提供文件操作相关的通用工具函数
 */

/**
 * 默认文件内容（新建文件时使用）
 */
export const DEFAULT_FILE_CONTENT = '\n';

/**
 * 无效文件名字符正则
 */
export const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;

// Re-export formatting helpers from fileFormatters.ts
export { isImageFile } from './fileFormatters';

/**
 * 从完整容器路径中提取相对路径
 * @param fullPath - 完整容器路径
 * @param projectName - 项目名称
 * @returns 相对路径
 */
export function extractRelativePath(fullPath: string, projectName: string): string {
  if (!fullPath.startsWith('/workspace/')) {
    return fullPath;
  }

  const parts = fullPath.split('/');
  const projectIndex = parts.findIndex(p => p === projectName);

  if (projectIndex === -1) {
    return fullPath.replace('/workspace/', '');
  }

  if (projectIndex === parts.length - 1) {
    return '.';
  }

  return parts.slice(projectIndex + 1).join('/');
}

/**
 * 验证文件名是否有效
 * @param name - 文件名
 * @returns 是否有效
 */
export function isValidFileName(name: string): boolean {
  if (!name || name.trim() === '') return false;
  if (INVALID_NAME_CHARS.test(name)) return false;
  if (name === '.' || name === '..') return false;
  return true;
}

/**
 * 递归查找文件节点
 * @param items - 文件节点数组
 * @param targetPath - 目标路径
 * @returns 找到的节点或null
 */
export function findFileByPath<T extends { path: string; children?: T[] }>(
  items: T[],
  targetPath: string
): T | null {
  for (const item of items) {
    if (item.path === targetPath) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findFileByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 递归过滤文件树
 * @param items - 文件节点数组
 * @param query - 搜索查询
 * @returns 过滤后的数组
 */
export function filterFileTree<T extends { name: string; type: string; children?: T[] }>(
  items: T[],
  query: string
): T[] {
  return items.reduce((filtered: T[], item) => {
    const matchesName = item.name.toLowerCase().includes(query);
    let filteredChildren: T[] = [];

    if (item.type === 'directory' && item.children) {
      filteredChildren = filterFileTree(item.children, query);
    }

    if (matchesName || filteredChildren.length > 0) {
      filtered.push({
        ...item,
        children: filteredChildren
      });
    }

    return filtered;
  }, []);
}
