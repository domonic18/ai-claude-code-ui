/**
 * 文件树工具
 *
 * 提供从目录路径生成文件树结构的函数
 * 支持过滤和元数据功能。
 */

import { promises as fsPromises } from 'fs';
import path from 'path';
import { createLogger } from './logger.js';
const logger = createLogger('utils/file-tree');

/**
 * 将权限位转换为 rwx 格式
 * @param {number} perm - 权限位 (0-7)
 * @returns {string} rwx 格式字符串 (例如 'rwx', 'r-x', '---')
 */
function permToRwx(perm) {
  const r = (perm & 4) ? 'r' : '-';
  const w = (perm & 2) ? 'w' : '-';
  const x = (perm & 1) ? 'x' : '-';
  return r + w + x;
}

/**
 * 跳过大型构建目录
 * @param {string} name - 目录/文件名
 * @returns {boolean} 是否应跳过
 */
function _shouldSkipEntry(name) {
  const SKIP_DIRS = ['node_modules', 'dist', 'build'];
  return SKIP_DIRS.includes(name);
}

/**
 * 获取文件元数据（权限、大小、修改时间）
 * @param {Object} item - 文件项对象
 * @param {string} itemPath - 文件路径
 */
async function _getFileMetadata(item, itemPath) {
  try {
    const stats = await fsPromises.stat(itemPath);
    const mode = stats.mode;
    const ownerPerm = (mode >> 6) & 7;
    const groupPerm = (mode >> 3) & 7;
    const otherPerm = mode & 7;

    Object.assign(item, {
      size: stats.size,
      modified: stats.mtime.toISOString(),
      permissions: String(ownerPerm) + groupPerm + otherPerm,
      permissionsRwx: permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm)
    });
  } catch (statError) {
    Object.assign(item, {
      size: 0,
      modified: null,
      permissions: '000',
      permissionsRwx: '---------'
    });
  }
}

/**
 * 尝试递归读取子目录
 * @param {Object} item - 目录项对象
 * @param {number} maxDepth - 最大深度
 * @param {number} currentDepth - 当前深度
 * @param {boolean} showHidden - 是否显示隐藏文件
 */
async function _tryReadChildren(item, maxDepth, currentDepth, showHidden) {
  try {
    await fsPromises.access(item.path, fsPromises.constants.R_OK);
    item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
  } catch (e) {
    item.children = [];
  }
}

/**
 * 排序文件树项（目录优先，然后按名称）
 * @param {Array} items - 文件项数组
 * @returns {Array} 排序后的数组
 */
function _sortFileTree(items) {
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * 获取目录的文件树结构
 * @param {string} dirPath - 要扫描的目录路径
 * @param {number} maxDepth - 最大遍历深度 (默认: 3)
 * @param {number} currentDepth - 当前深度级别 (默认: 0)
 * @param {boolean} showHidden - 包含隐藏文件 (默认: true)
 * @returns {Promise<Array>} 文件/目录对象数组
 */
export async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
  const items = [];

  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (_shouldSkipEntry(entry.name)) continue;

      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };

      await _getFileMetadata(item, itemPath);

      const shouldRecurse = entry.isDirectory() && currentDepth < maxDepth;
      if (shouldRecurse) {
        await _tryReadChildren(item, maxDepth, currentDepth, showHidden);
      }

      items.push(item);
    }
  } catch (error) {
    const isPermissionError = error.code === 'EACCES' || error.code === 'EPERM';
    if (!isPermissionError) {
      logger.error('读取目录错误:', error);
    }
  }

  return _sortFileTree(items);
}
