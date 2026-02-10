/**
 * FileMover.js
 *
 * 文件移动操作类
 * 在 Docker 容器中执行文件/目录移动操作
 *
 * @module files/adapters/operations/FileMover
 */

import containerManager from '../../../container/core/index.js';
import { CONTAINER } from '../../../../config/config.js';
import { PathUtils } from '../../../core/utils/path-utils.js';

/** Operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/**
 * 文件移动器类
 */
export class FileMover {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 移动文件或目录
   * @param {string} sourcePath - 源路径
   * @param {string} targetDir - 目标目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async move(sourcePath, targetDir, options = {}) {
    const { userId, projectPath = '', isContainerProject = false } = options;

    // 验证源路径
    if (!sourcePath || sourcePath.trim() === '') {
      throw new Error('Source path is required');
    }

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 解析源路径
    const sourceContainerPath = this.adapter._resolveContainerPath(sourcePath, options);

    // 构建目标路径
    const targetContainerPath = this._buildTargetPath(
      sourceContainerPath,
      targetDir,
      { projectPath, isContainerProject }
    );

    // 检查源和目标是否相同（文件已经在目标位置）
    if (sourceContainerPath === targetContainerPath) {
      // 文件已经在目标位置，视为成功
      return { success: true, newPath: sourceContainerPath };
    }

    // 检查目标是否已存在
    await this._checkTargetExists(targetContainerPath, userId);

    // 执行移动
    return this._executeMove(sourceContainerPath, targetContainerPath, userId);
  }

  /**
   * 构建目标路径
   * @private
   */
  _buildTargetPath(sourcePath, targetDir, options) {
    const { projectPath = '', isContainerProject = false } = options;

    let targetDirPath;

    if (targetDir === '' || targetDir === null || targetDir === undefined) {
      // 移动到根目录
      const fileName = sourcePath.split('/').pop();
      if (isContainerProject && projectPath) {
        targetDirPath = `${CONTAINER.paths.workspace}/${projectPath}`;
      } else if (projectPath) {
        targetDirPath = `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}`;
      } else {
        targetDirPath = CONTAINER.paths.workspace;
      }
      return `${targetDirPath}/${fileName}`;
    }

    // 移动到指定目录
    targetDirPath = this.adapter._resolveContainerPath(targetDir, options);
    const fileName = sourcePath.split('/').pop();
    return `${targetDirPath}/${fileName}`.replace(/\/+/g, '/');
  }

  /**
   * 检查目标是否已存在
   * @private
   */
  async _checkTargetExists(targetPath, userId) {
    const checkCommand = `test -e "${targetPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
    const { stream: checkStream } = await containerManager.execInContainer(userId, checkCommand);

    const targetExists = await new Promise((resolve) => {
      let output = '';
      checkStream.on('data', (chunk) => {
        output += chunk.toString();
      });
      checkStream.on('end', () => {
        resolve(output.trim() === 'EXISTS');
      });
      checkStream.on('error', () => {
        resolve(false);
      });
    });

    if (targetExists) {
      throw new Error('Target location already exists with the same name');
    }
  }

  /**
   * 执行移动操作
   * @private
   */
  async _executeMove(sourcePath, targetPath, userId) {
    const moveCommand = `mv "${sourcePath}" "${targetPath}" 2>&1`;
    const { stream } = await containerManager.execInContainer(userId, moveCommand);

    return new Promise((resolve, reject) => {
      let resolved = false;
      let output = '';

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

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        doReject(new Error(`Failed to move: ${err.message}`));
      });

      stream.on('end', () => {
        if (output.trim() && output.toLowerCase().includes('cannot')) {
          doReject(new Error(`Move failed: ${output}`));
          return;
        }
        doResolve({ success: true, newPath: targetPath });
      });

      setTimeout(() => {
        doResolve({ success: true, newPath: targetPath });
      }, OPERATION_TIMEOUT_MS);
    });
  }
}

export default FileMover;
