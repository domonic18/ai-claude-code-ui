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
import { parseFileTreeOutput, buildTreeStructure } from './fileTreeParsers.js';

// 文件适配器将文件树检索委托给此类以用于目录浏览
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

  // 文件浏览器侧边栏调用此函数显示项目目录结构
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
    if (!output || output.trim() === '') {
      return [];
    }

    const parsed = parseFileTreeOutput(output, basePath);
    return buildTreeStructure(
      parsed.validPaths,
      parsed.pathTypeMap,
      parsed.pathSizeMap,
      parsed.pathMtimeMap,
      basePath,
      this.adapter
    );
  }
}

export default FileTreeBuilder;
