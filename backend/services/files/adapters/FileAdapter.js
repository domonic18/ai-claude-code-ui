/**
 * FileAdapter.js
 *
 * 文件操作适配器
 * 在 Docker 容器中执行文件操作
 *
 * @module files/adapters/FileAdapter
 */

import { BaseFileAdapter } from './BaseFileAdapter.js';
import containerManager from '../../container/core/index.js';
import { CONTAINER } from '../../../config/config.js';
import { PathUtils } from '../../core/utils/path-utils.js';

/**
 * 文件操作适配器
 * 在用户专属的 Docker 容器中执行文件操作
 */
export class FileAdapter extends BaseFileAdapter {
  /**
   * 构造函数
   * @param {Object} config - 适配器配置
   */
  constructor(config = {}) {
    super({
      name: 'FileAdapter',
      version: '2.0.0',
      ...config
    });
    this.adapterType = 'container';
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    const {
      userId,
      encoding = 'utf8',
      projectPath = '',
      isContainerProject = false
    } = options;

    try {
      // 清理路径中的 ./ 和 //
      let cleanPath = filePath.replace(/\/\.\//g, '/').replace(/\/+/g, '/');

      let containerPath;

      // 检查是否是绝对路径（以 /workspace 开头）
      if (cleanPath.startsWith('/workspace')) {
        // 已经是绝对路径，直接使用
        containerPath = cleanPath;
      } else {
        // 相对路径，需要构建完整路径
        // 移除开头的斜杠（如果有）
        if (cleanPath.startsWith('/')) {
          cleanPath = cleanPath.substring(1);
        }

        // 验证路径
        const validation = this._validatePath(cleanPath, options);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // 构建容器路径
        containerPath = this._buildContainerPath(
          validation.safePath,
          { projectPath, isContainerProject }
        );
      }

      console.log('[FileAdapter] readFile:', { filePath, cleanPath, containerPath });

      // 验证路径安全性
      if (containerPath.includes('..')) {
        throw new Error('Path traversal detected');
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 执行 cat 命令读取文件
      const { stream } = await containerManager.execInContainer(
        userId,
        `cat "${containerPath}"`
      );

      return new Promise((resolve, reject) => {
        let content = '';
        let errorOutput = '';

        stream.on('data', (chunk) => {
          const output = chunk.toString();
          if (output.includes('No such file') || output.includes('cannot access')) {
            errorOutput += output;
          } else {
            content += output;
          }
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to read file: ${err.message}`));
        });

        stream.on('end', () => {
          if (errorOutput) {
            reject(new Error(`File not found: ${filePath}`));
          } else {
            resolve({
              content: content.replace(/\s+$/, ''),
              path: containerPath
            });
          }
        });
      });
    } catch (error) {
      throw this._standardizeError(error, 'readFile');
    }
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    const {
      userId,
      encoding = 'utf8',
      projectPath = '',
      isContainerProject = false
    } = options;

    try {
      // 清理路径中的 ./ 和 //
      let cleanPath = filePath.replace(/\/\.\//g, '/').replace(/\/+/g, '/');

      let containerPath;

      // 检查是否是绝对路径（以 /workspace 开头）
      if (cleanPath.startsWith('/workspace')) {
        // 已经是绝对路径，直接使用
        containerPath = cleanPath;
      } else {
        // 相对路径，需要构建完整路径
        // 移除开头的斜杠（如果有）
        if (cleanPath.startsWith('/')) {
          cleanPath = cleanPath.substring(1);
        }

        // 验证路径
        const validation = this._validatePath(cleanPath, options);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // 构建容器路径
        containerPath = this._buildContainerPath(
          validation.safePath,
          { projectPath, isContainerProject }
        );
      }

      // 验证路径安全性
      if (containerPath.includes('..')) {
        throw new Error('Path traversal detected');
      }

      // 验证文件大小
      const sizeValidation = this._validateFileSize(content);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 如果目录不存在则创建
      const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
      const projectsBasePath = CONTAINER.paths.projects;
      const workspacePath = CONTAINER.paths.workspace;

      if (dirPath && dirPath !== workspacePath && dirPath !== projectsBasePath) {
        await new Promise(async (resolve, reject) => {
          const result = await containerManager.execInContainer(
            userId,
            `mkdir -p "${dirPath}"`
          );
          const mkdirStream = result.stream;
          mkdirStream.on('end', resolve);
          mkdirStream.on('error', reject);
        });
      }

      // 使用 base64 安全处理特殊字符
      const base64Content = Buffer.from(content, encoding).toString('base64');

      const { stream } = await containerManager.execInContainer(
        userId,
        `printf '%s' "$(echo '${base64Content}' | base64 -d)" > "${containerPath}"`
      );

      return new Promise((resolve, reject) => {
        let errorOutput = '';
        let resolved = false;
        let timeoutId = null;

        const doResolve = (result) => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve(result);
          }
        };

        const doReject = (err) => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(err);
          }
        };

        stream.on('data', (chunk) => {
          const output = chunk.toString();
          if (output.toLowerCase().includes('error') ||
              output.toLowerCase().includes('cannot') ||
              output.toLowerCase().includes('permission denied')) {
            errorOutput += output;
          }
        });

        stream.on('error', (err) => {
          doReject(new Error(`Failed to write file: ${err.message}`));
        });

        stream.on('end', () => {
          if (errorOutput) {
            doReject(new Error(`Write failed: ${errorOutput}`));
          } else {
            doResolve({ success: true, path: containerPath });
          }
        });

        timeoutId = setTimeout(() => {
          doResolve({ success: true, path: containerPath });
        }, 3000);
      });
    } catch (error) {
      throw this._standardizeError(error, 'writeFile');
    }
  }

  /**
   * 获取文件树结构
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   */
  async getFileTree(dirPath, options = {}) {
    const {
      userId,
      maxDepth = 3,
      excludedDirs = ['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', 'target', 'bin', 'obj'],
      projectPath = '',
      isContainerProject = false
    } = options;

    try {
      // 验证路径
      const validation = this._validatePath(dirPath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 构建容器路径
      const containerPath = this._buildContainerPath(
        validation.safePath,
        { projectPath, isContainerProject }
      );

      // 使用 find 命令获取文件树
      const excludeArgs = excludedDirs.map(d => `-name "${d}" -prune -o`).join(' ');
      const command = `find ${containerPath} ${excludeArgs} -type f -o -type d | head -1000`;

      const { stream } = await containerManager.execInContainer(userId, command);

      return new Promise((resolve, reject) => {
        let output = '';

        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to get file tree: ${err.message}`));
        });

        stream.on('end', () => {
          const lines = output.trim().split('\n').filter(Boolean);
          const tree = this._parseFileTreeOutput(lines, containerPath);
          resolve(tree);
        });
      });
    } catch (error) {
      throw this._standardizeError(error, 'getFileTree');
    }
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   */
  async getFileStats(filePath, options = {}) {
    const { userId, projectPath = '', isContainerProject = false } = options;

    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 构建容器路径
      const containerPath = this._buildContainerPath(
        validation.safePath,
        { projectPath, isContainerProject }
      );

      // 使用 stat 命令获取文件信息
      const { stream } = await containerManager.execInContainer(
        userId,
        `stat -c "%F|%s|%Y|%A" "${containerPath}"`
      );

      return new Promise((resolve, reject) => {
        let output = '';

        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to get file stats: ${err.message}`));
        });

        stream.on('end', () => {
          try {
            const [type, size, mtime, mode] = output.trim().split('|');

            resolve({
              type: type.includes('directory') ? 'directory' : 'file',
              size: parseInt(size, 10),
              modified: new Date(parseInt(mtime, 10) * 1000).toISOString(),
              mode
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse file stats: ${parseError.message}`));
          }
        });
      });
    } catch (error) {
      throw this._standardizeError(error, 'getFileStats');
    }
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    const { userId, projectPath = '', isContainerProject = false } = options;

    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 构建容器路径
      const containerPath = this._buildContainerPath(
        validation.safePath,
        { projectPath, isContainerProject }
      );

      // 删除文件或目录
      const { stream } = await containerManager.execInContainer(
        userId,
        `rm -rf "${containerPath}"`
      );

      return new Promise((resolve, reject) => {
        let resolved = false;
        let timeoutId = null;

        const doResolve = (result) => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve(result);
          }
        };

        const doReject = (err) => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(err);
          }
        };

        stream.on('error', (err) => {
          doReject(new Error(`Failed to delete file: ${err.message}`));
        });

        stream.on('end', () => {
          doResolve({ success: true });
        });

        timeoutId = setTimeout(() => {
          doResolve({ success: true });
        }, 2000);
      });
    } catch (error) {
      throw this._standardizeError(error, 'deleteFile');
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath, options = {}) {
    const { userId, projectPath = '', isContainerProject = false } = options;

    try {
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        return false;
      }

      await containerManager.getOrCreateContainer(userId);

      const containerPath = this._buildContainerPath(
        validation.safePath,
        { projectPath, isContainerProject }
      );

      const { stream } = await containerManager.execInContainer(
        userId,
        `test -f "${containerPath}" || test -d "${containerPath}"`
      );

      return new Promise((resolve) => {
        stream.on('error', () => resolve(false));
        stream.on('end', () => resolve(true));
      });
    } catch {
      return false;
    }
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    const { userId, recursive = true, projectPath = '', isContainerProject = false } = options;

    try {
      const validation = this._validatePath(dirPath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      await containerManager.getOrCreateContainer(userId);

      const containerPath = this._buildContainerPath(
        validation.safePath,
        { projectPath, isContainerProject }
      );

      const recursiveFlag = recursive ? '-p' : '';

      await new Promise(async (resolve, reject) => {
        const result = await containerManager.execInContainer(
          userId,
          `mkdir ${recursiveFlag} "${containerPath}"`
        );
        const stream = result.stream;
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      return {
        success: true,
        path: containerPath
      };
    } catch (error) {
      throw this._standardizeError(error, 'createDirectory');
    }
  }

  /**
   * 构建容器内路径
   * @private
   * @param {string} safePath - 安全路径
   * @param {Object} options - 选项
   * @returns {string} 容器路径
   */
  _buildContainerPath(safePath, options = {}) {
    const { projectPath = '', isContainerProject = false } = options;

    if (isContainerProject && projectPath) {
      // 容器项目：项目代码在 /workspace 下
      return `${CONTAINER.paths.workspace}/${projectPath}/${safePath}`.replace(/\/+/g, '/');
    } else if (projectPath) {
      // 会话项目：使用 .claude/projects
      return `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}/${safePath}`.replace(/\/+/g, '/');
    } else {
      // 默认：workspace
      return `${CONTAINER.paths.workspace}/${safePath}`.replace(/\/+/g, '/');
    }
  }

  /**
   * 解析文件树输出
   * @private
   * @param {Array<string>} lines - 输出行
   * @param {string} basePath - 基础路径
   * @returns {Array} 文件树
   */
  _parseFileTreeOutput(lines, basePath) {
    const tree = [];
    const processedPaths = new Set();

    // 预先收集所有路径，用于判断是文件还是目录
    const allPaths = new Set(lines);


    for (const line of lines) {
      // 跳过空行
      if (!line || line.trim() === '') {
        continue;
      }

      const relativePath = line.replace(basePath + '/', '').replace(basePath, '');

      // 跳过隐藏文件/目录（路径的任何部分以点开头）
      const pathParts = relativePath.split('/');
      if (pathParts.some(part => this._isHiddenFile(part))) {
        continue;
      }

      if (processedPaths.has(relativePath)) {
        continue;
      }
      processedPaths.add(relativePath);

      const parts = relativePath.split('/').filter(Boolean).map(name => this._cleanFileName(name));

      // 验证每个部分是否有效
      if (parts.length === 0 || parts.some(part => part === '' || !this._isValidFileName(part))) {
        console.log('[FileAdapter] Skipping invalid path:', relativePath, '->', parts);
        continue; // 跳过无效路径
      }

      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // 构建到当前部分的完整路径
        const pathSoFar = `${basePath}/${parts.slice(0, i + 1).join('/')}`;
        // 判断是否为目录
        const isDir = this._isDirectory(pathSoFar, allPaths);

        let existing = currentLevel.find(item => item.name === part);

        if (!existing) {
          existing = {
            name: part,
            type: isDir ? 'directory' : 'file',
            path: pathSoFar
          };

          if (isDir) {
            existing.children = [];
          }

          currentLevel.push(existing);
        } else if (isDir && !existing.children) {
          // 如果已存在的节点是文件，但我们需要它作为目录，更新它
          existing.type = 'directory';
          existing.children = [];
        }

        if (isDir) {
          // 确保 currentLevel 始终是一个数组
          currentLevel = existing.children || tree;
        }
      }
    }

    return tree;
  }
}

export default FileAdapter;
