/**
 * FileTreeBuilder.js
 *
 * 文件树构建操作类
 * 在 Docker 容器中执行文件树查询和解析
 *
 * @module files/adapters/operations/FileTreeBuilder
 */

import { PassThrough } from 'stream';
import containerManager from '../../../container/core/index.js';

/**
 * 文件树构建器类
 */
export class FileTreeBuilder {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 获取文件树结构
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   */
  async build(dirPath, options = {}) {
    const {
      userId,
      maxDepth = 3,
      excludedDirs = ['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', 'target', 'bin', 'obj'],
      projectPath = '',
      isContainerProject = false
    } = options;

    // 验证路径
    const validation = this.adapter._validatePath(dirPath, options);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    const containerPath = this.adapter._buildContainerPath(
      validation.safePath,
      { projectPath, isContainerProject }
    );

    // 使用 find 命令获取文件树
    const excludeArgs = excludedDirs.map(d => `-name "${d}" -prune -o`).join(' ');
    const command = `find ${containerPath} ${excludeArgs} \\( -type d -o -type f -o -type l \\) -printf "%p\\0%y\\0%s\\0%T@\\0" 2>/dev/null | head -c 200000`;

    const { stream } = await containerManager.execInContainer(userId, command);

    // 使用 demuxStream 移除 8 字节协议头
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve, reject) => {
      let output = '';

      stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to get file tree: ${err.message}`));
      });

      stream.on('end', () => {
        const tree = this._parseOutput(output, containerPath);
        resolve(tree);
      });
    });
  }

  /**
   * 解析文件树输出
   * @private
   * @param {string} output - 输出字符串
   * @param {string} basePath - 基础路径
   * @returns {Array} 文件树
   */
  _parseOutput(output, basePath) {
    const tree = [];
    const processedPaths = new Set();

    if (!output || output.trim() === '') {
      return tree;
    }

    // 解析输出：路径\0类型\0大小\0修改时间\0...
    const parts = output.split('\0');
    const pathTypeMap = new Map();
    const pathSizeMap = new Map();
    const pathMtimeMap = new Map();
    const validPaths = [];

    // 每4个元素为一组
    for (let i = 0; i < parts.length - 3; i += 4) {
      const fullPath = parts[i];
      const typeFlag = parts[i + 1];
      const sizeStr = parts[i + 2];
      const mtimeStr = parts[i + 3];

      if (!fullPath || !typeFlag) continue;
      if (!fullPath.startsWith(basePath)) continue;

      // 转换 find 的类型标识
      let type = 'file';
      if (typeFlag === 'd' || typeFlag === 'l') {
        type = 'directory';
      }

      const size = parseInt(sizeStr, 10) || 0;
      const mtime = parseFloat(mtimeStr) || 0;

      pathTypeMap.set(fullPath, type);
      pathSizeMap.set(fullPath, size);
      pathMtimeMap.set(fullPath, mtime);
      validPaths.push(fullPath);
    }

    // 构建文件树
    return this._buildTree(validPaths, pathTypeMap, pathSizeMap, pathMtimeMap, basePath, processedPaths);
  }

  /**
   * 构建树结构
   * @private
   */
  _buildTree(validPaths, pathTypeMap, pathSizeMap, pathMtimeMap, basePath, processedPaths) {
    const tree = [];

    for (const fullPath of validPaths) {
      const relativePath = fullPath.replace(basePath + '/', '').replace(basePath, '');

      // 跳过隐藏文件
      const pathParts = relativePath.split('/');
      if (pathParts.some(part => this.adapter._isHiddenFile(part))) continue;
      if (processedPaths.has(relativePath)) continue;

      processedPaths.add(relativePath);

      const parts = relativePath.split('/').filter(Boolean).map(name => this.adapter._cleanFileName(name));
      if (parts.length === 0 || parts.some(part => part === '' || !this.adapter._isValidFileName(part))) {
        continue;
      }

      this._addNodeToTree(tree, parts, basePath, pathTypeMap, pathSizeMap, pathMtimeMap);
    }

    return tree;
  }

  /**
   * 添加节点到树
   * @private
   */
  _addNodeToTree(tree, parts, basePath, pathTypeMap, pathSizeMap, pathMtimeMap) {
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const pathSoFar = `${basePath}/${parts.slice(0, i + 1).join('/')}`;
      const type = pathTypeMap.get(pathSoFar) || 'file';
      const size = pathSizeMap.get(pathSoFar) || 0;
      const mtime = pathMtimeMap.get(pathSoFar) || 0;

      let existing = currentLevel.find(item => item.name === part);

      if (!existing) {
        existing = {
          name: part,
          type: type,
          path: pathSoFar,
          size: type === 'file' ? size : 0,
          modified: mtime ? new Date(mtime * 1000).toISOString() : null
        };

        if (type === 'directory') {
          existing.children = [];
        }

        currentLevel.push(existing);
      } else if (type === 'directory' && !existing.children) {
        existing.type = 'directory';
        existing.children = [];
      }

      if (type === 'directory') {
        currentLevel = existing.children || tree;
      }
    }
  }
}

export default FileTreeBuilder;
