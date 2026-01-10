/**
 * 文件树工具
 *
 * 提供从目录路径生成文件树结构的函数
 * 支持过滤和元数据功能。
 */

import { promises as fsPromises } from 'fs';
import path from 'path';

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
      // 仅跳过大型构建目录
      if (entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build') continue;

      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };

      // 获取文件统计信息以获取额外的元数据
      try {
        const stats = await fsPromises.stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();

        // 将权限转换为 rwx 格式
        const mode = stats.mode;
        const ownerPerm = (mode >> 6) & 7;
        const groupPerm = (mode >> 3) & 7;
        const otherPerm = mode & 7;
        item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch (statError) {
        // 如果 stat 失败，提供默认值
        item.size = 0;
        item.modified = null;
        item.permissions = '000';
        item.permissionsRwx = '---------';
      }

      if (entry.isDirectory() && currentDepth < maxDepth) {
        // 递归获取子目录但限制深度
        try {
          // 在尝试读取目录之前检查是否可以访问该目录
          await fsPromises.access(item.path, fsPromises.constants.R_OK);
          item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
        } catch (e) {
          // 静默跳过无法访问的目录（权限被拒绝等）
          item.children = [];
        }
      }

      items.push(item);
    }
  } catch (error) {
    // 仅记录非权限错误以避免垃圾信息
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      console.error('读取目录错误:', error);
    }
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
