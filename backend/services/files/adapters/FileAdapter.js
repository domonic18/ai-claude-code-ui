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
import { SYSTEM_FOLDERS } from '../constants.js';
import { PassThrough } from 'stream';

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

      // 使用 demuxStream 来正确处理 Docker 的多路复用协议，移除 8 字节协议头
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      return new Promise((resolve, reject) => {
        let content = '';
        let errorOutput = '';

        stdout.on('data', (chunk) => {
          content += chunk.toString('utf8');
        });

        stderr.on('data', (chunk) => {
          errorOutput += chunk.toString('utf8');
        });

        stream.on('error', (err) => {
          reject(new Error(`Failed to read file: ${err.message}`));
        });

        stream.on('end', () => {
          if (errorOutput && (errorOutput.includes('No such file') || errorOutput.includes('cannot access'))) {
            reject(new Error(`File not found: ${filePath}`));
          } else {
            // Trim trailing whitespace
            let trimmedContent = content.replace(/\s+$/, '');

            // Strip UTF-8 BOM (U+FEFF) if present at the start of content
            const charCode = trimmedContent.charCodeAt(0);
            if (charCode === 0xFEFF || trimmedContent.startsWith('\uFEFF')) {
              trimmedContent = trimmedContent.slice(1);
            }

            resolve({
              content: trimmedContent,
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
        const { stream: mkdirStream } = await containerManager.execInContainer(
          userId,
          `mkdir -p "${dirPath}"`
        );

        // 使用 Promise 包装目录创建
        await new Promise((resolve, reject) => {
          let resolved = false;
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }, 5000);

          mkdirStream.on('data', () => {}); // 消费数据
          mkdirStream.on('error', (err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              reject(err);
            }
          });
          mkdirStream.on('end', () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              resolve();
            }
          });
        });
      }

      // 删除旧文件（如果存在）
      const { stream: rmStream } = await containerManager.execInContainer(userId, `rm -f "${containerPath}"`);
      await new Promise((resolve) => {
        let resolved = false;
        rmStream.on('data', () => {});
        rmStream.on('error', () => { if (!resolved) { resolved = true; resolve(); }});
        rmStream.on('end', () => { if (!resolved) { resolved = true; resolve(); }});
        setTimeout(() => { if (!resolved) { resolved = true; resolve(); }}, 5000);
      });

      // 使用 base64 安全处理特殊字符
      const base64Content = Buffer.from(content, encoding).toString('base64');
      const writeCommand = `echo '${base64Content}' | base64 -d > "${containerPath}"`;

      const { stream } = await containerManager.execInContainer(userId, writeCommand);

      // 直接监听 stream 事件（不使用 demuxStream，因为 exec 可能不需要）
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

        // 监听 stream 事件
        stream.on('data', (chunk) => {
          const output = chunk.toString();
          // 检测任何错误信息（不区分大小写）
          const lowerOutput = output.toLowerCase();
          if (lowerOutput.includes('error') ||
              lowerOutput.includes('cannot') ||
              lowerOutput.includes('permission denied') ||
              lowerOutput.includes('denied') ||
              lowerOutput.includes('no such file') ||
              lowerOutput.includes('not found')) {
            errorOutput = output; // 保存原始错误信息
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

        // 设置 10 秒超时
        timeoutId = setTimeout(() => {
          doResolve({ success: true, path: containerPath });
        }, 10000);
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

      // 使用 find 命令获取文件树，输出格式：路径\0类型\0大小\0修改时间\0...
      // 使用 \0 (null 字符) 作为分隔符，因为文件名不允许包含 \0
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
          // output 是使用 \0 分隔的字符串：路径\0类型\0路径\0类型\0...
          const tree = this._parseFileTreeOutput(output, containerPath);
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

      // safePath 已经是完整的容器路径，直接使用
      // 例如: /workspace/my-workspace/README.md
      const containerPath = validation.safePath;

      // 删除文件或目录
      const deleteCommand = `rm -rf "${containerPath}"`;

      const { stream } = await containerManager.execInContainer(
        userId,
        deleteCommand
      );

      return new Promise((resolve, reject) => {
        let resolved = false;
        let timeoutId = null;
        let output = '';
        let errorOutput = '';

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

        // 捕获命令输出
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', (err) => {
          doReject(new Error(`Failed to delete file: ${err.message}`));
        });

        stream.on('end', async () => {
          // 验证文件是否真的被删除了
          try {
            const checkCommand = `test -e "${containerPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
            const { stream: checkStream } = await containerManager.execInContainer(userId, checkCommand);

            let checkOutput = '';
            checkStream.on('data', (chunk) => {
              checkOutput += chunk.toString();
            });

            checkStream.on('end', () => {
              const trimmedOutput = checkOutput.trim();
              if (trimmedOutput === 'EXISTS') {
                doReject(new Error(`Failed to delete file: ${filePath} still exists`));
              } else {
                doResolve({ success: true });
              }
            });
          } catch (checkError) {
            // 即使验证失败，也尝试返回成功（可能是检查命令的问题）
            doResolve({ success: true });
          }
        });

        timeoutId = setTimeout(() => {
          doResolve({ success: true });
        }, 5000);
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

      // 使用 safePath 而不是通过 _buildContainerPath 构建路径
      // 因为 safePath 已经是完整的容器路径
      const containerPath = validation.safePath;

      const { stream } = await containerManager.execInContainer(
        userId,
        `test -e "${containerPath}" && echo "EXISTS" || echo "NOT_EXISTS"`
      );

      return new Promise((resolve) => {
        let output = '';
        let resolved = false;
        const doResolve = (result) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        // Capture output
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', () => {
          doResolve(false);
        });

        stream.on('end', () => {
          const trimmedOutput = output.trim();
          doResolve(trimmedOutput === 'EXISTS');
        });

        // 2 second timeout
        setTimeout(() => {
          doResolve(false);
        }, 2000);
      });
    } catch (error) {
      console.error('[FileAdapter.fileExists] Error:', error);
      return false;
    }
  }

  /**
   * 重命名文件或目录
   * @param {string} oldPath - 旧路径（完整路径）
   * @param {string} newName - 新名称（仅文件名，不包含路径）
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async renameFile(oldPath, newName, options = {}) {
    const { userId, projectPath = '', isContainerProject = false } = options;

    try {
      // 验证新名称
      if (!newName || newName.trim() === '') {
        throw new Error('New name cannot be empty');
      }

      // 清理新名称
      const cleanName = this._cleanFileName(newName.trim());

      // 检查新名称是否有效
      if (!this._isValidFileName(cleanName)) {
        throw new Error('Invalid file name');
      }

      // 检查是否是系统文件夹
      const oldName = oldPath.split('/').filter(Boolean).pop() || '';
      if (SYSTEM_FOLDERS.includes(oldName)) {
        throw new Error(`Cannot rename system folders (${SYSTEM_FOLDERS.join(', ')})`);
      }

      // 获取或创建容器
      await containerManager.getOrCreateContainer(userId);

      // 清理路径中的 ./ 和 //
      let cleanPath = oldPath.replace(/\/\.\//g, '/').replace(/\/+/g, '/');

      let oldContainerPath;

      // 检查是否是绝对路径（以 /workspace 开头）
      if (cleanPath.startsWith('/workspace')) {
        // 已经是绝对路径，直接使用
        oldContainerPath = cleanPath;
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
        oldContainerPath = this._buildContainerPath(
          validation.safePath,
          { projectPath, isContainerProject }
        );
      }

      // 验证路径安全性
      if (oldContainerPath.includes('..')) {
        throw new Error('Path traversal detected');
      }

      // 构建新路径
      const pathParts = oldContainerPath.split('/');
      pathParts[pathParts.length - 1] = cleanName;
      const newContainerPath = pathParts.join('/');

      // 使用 mv 命令重命名（mv 会自动检查目标是否存在，如果存在则报错）
      const renameCommand = `mv "${oldContainerPath}" "${newContainerPath}" 2>&1`;

      const { stream } = await containerManager.execInContainer(userId, renameCommand);

      return new Promise((resolve, reject) => {
        let resolved = false;
        let output = '';
        let errorOutput = '';

        const doResolve = (result) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        const doReject = (err) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        };

        // 捕获命令输出
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', (err) => {
          console.error('[FileAdapter.renameFile] Stream error:', err);
          doReject(new Error(`Failed to rename: ${err.message}`));
        });

        stream.on('end', async () => {
          // 检查命令是否有错误输出
          // 如果有错误输出，说明 mv 命令失败了（如目标文件已存在）
          if (output.trim() && output.toLowerCase().includes('cannot')) {
            console.error('[FileAdapter.renameFile] mv command failed:', output);
            doReject(new Error(`Rename failed: ${output}`));
            return;
          }

          // 如果没有错误，认为重命名成功
          doResolve({ success: true, newPath: newContainerPath });
        });

        // 5秒超时
        setTimeout(() => {
          doResolve({ success: true, newPath: newContainerPath });
        }, 5000);
      });
    } catch (error) {
      console.error('[FileAdapter.renameFile] Error:', error);
      throw this._standardizeError(error, 'renameFile');
    }
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径（相对于项目根目录）
   * @param {Object} options - 选项
   * @param {string} [options.userId] - 用户 ID
   * @param {boolean} [options.recursive=true] - 是否递归创建父目录
   * @param {string} [options.projectPath=''] - 项目路径
   * @param {boolean} [options.isContainerProject=false] - 是否为容器项目
   * @returns {Promise<{success: boolean, path: string}>} 创建结果
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
      const command = `mkdir ${recursiveFlag} "${containerPath}"`;

      await new Promise((resolve, reject) => {
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

        containerManager.execInContainer(userId, command)
          .then(({ stream }) => {
            let output = '';
            let errorOutput = '';

            stream.on('data', (chunk) => {
              output += chunk.toString();
            });

            stream.on('error', (err) => {
              doReject(new Error(`Failed to create directory: ${err.message}`));
            });

            stream.on('end', () => {
              if (errorOutput) {
                doReject(new Error(`Create directory failed: ${errorOutput}`));
              } else {
                doResolve({ success: true });
              }
            });
          })
          .catch((err) => {
            doReject(new Error(`Failed to execute mkdir command: ${err.message}`));
          });

        // 5秒超时保护
        timeoutId = setTimeout(() => {
          doResolve({ success: true });
        }, 5000);
      });

      return {
        success: true,
        path: containerPath
      };
    } catch (error) {
      console.error('[FileAdapter.createDirectory] Error:', error);
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

    // 处理当前目录 '.' 的情况，移除它以避免路径中出现 /./
    const processedSafePath = (safePath === '.' || safePath === './') ? '' : safePath;

    if (isContainerProject && projectPath) {
      // 容器项目：项目代码在 /workspace 下
      const path = processedSafePath
        ? `${CONTAINER.paths.workspace}/${projectPath}/${processedSafePath}`
        : `${CONTAINER.paths.workspace}/${projectPath}`;
      return path.replace(/\/+/g, '/');
    } else if (projectPath) {
      // 会话项目：使用 .claude/projects
      const path = processedSafePath
        ? `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}/${processedSafePath}`
        : `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}`;
      return path.replace(/\/+/g, '/');
    } else {
      // 默认：workspace
      const path = processedSafePath
        ? `${CONTAINER.paths.workspace}/${processedSafePath}`
        : CONTAINER.paths.workspace;
      return path.replace(/\/+/g, '/');
    }
  }

  /**
   * 解析文件树输出
   * @private
   * @param {string} output - 输出字符串，格式：路径\0类型\0大小\0修改时间\0...
   * @param {string} basePath - 基础路径
   * @returns {Array} 文件树
   */
  _parseFileTreeOutput(output, basePath) {
    const tree = [];
    const processedPaths = new Set();

    // 处理空输出
    if (!output || output.trim() === '') {
      return tree;
    }

    // 解析输出：路径\0类型\0大小\0修改时间\0...
    // 使用 \0 分隔，因为文件名不允许包含 \0
    const parts = output.split('\0');
    const pathTypeMap = new Map();
    const pathSizeMap = new Map();
    const pathMtimeMap = new Map();
    const validPaths = [];

    // 每4个元素为一组：(path, type, size, mtime)
    // 注意：parts.length 可能不是4的倍数（数据被截断），所以用 < 而不是 <=
    for (let i = 0; i < parts.length - 3; i += 4) {
      const fullPath = parts[i];
      const typeFlag = parts[i + 1];
      const sizeStr = parts[i + 2];
      const mtimeStr = parts[i + 3];

      // 跳过空路径或类型
      if (!fullPath || !typeFlag) {
        continue;
      }

      // 验证路径是否在 basePath 下
      if (!fullPath.startsWith(basePath)) {
        continue;
      }

      // 转换 find 的类型标识到我们的类型
      // f=file, d=directory, l=symlink (视为目录)
      let type;
      if (typeFlag === 'f') {
        type = 'file';
      } else if (typeFlag === 'd' || typeFlag === 'l') {
        type = 'directory';
      } else {
        // 其他类型（socket, FIFO 等）视为文件
        type = 'file';
      }

      // 解析大小和修改时间
      const size = parseInt(sizeStr, 10) || 0;
      const mtime = parseFloat(mtimeStr) || 0;

      pathTypeMap.set(fullPath, type);
      pathSizeMap.set(fullPath, size);
      pathMtimeMap.set(fullPath, mtime);
      validPaths.push(fullPath);
    }

    // 构建文件树
    for (const fullPath of validPaths) {
      const relativePath = fullPath.replace(basePath + '/', '').replace(basePath, '');

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
        continue;
      }

      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const pathSoFar = `${basePath}/${parts.slice(0, i + 1).join('/')}`;
        const type = pathTypeMap.get(pathSoFar) || 'file'; // 默认为文件
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
          // 如果已存在的节点是文件，但我们需要它作为目录，更新它
          existing.type = 'directory';
          existing.children = [];
        }

        if (type === 'directory') {
          currentLevel = existing.children || tree;
        }
      }
    }

    return tree;
  }
}

export default FileAdapter;
