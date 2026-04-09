/**
 * FileReader.js
 *
 * 文件读取操作类
 * 在 Docker 容器中执行文件读取操作
 *
 * @module files/adapters/operations/FileReader
 */

import { PassThrough } from 'stream';
import containerManager from '../../../container/core/index.js';

/**
 * 文件读取器类
 */
export class FileReader {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async read(filePath, options = {}) {
    const { userId, encoding = 'utf8' } = options;

    // 使用统一的路径解析方法
    const containerPath = this.adapter._resolveContainerPath(filePath, options);

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 执行 cat 命令读取文件
    const { stream } = await containerManager.execInContainer(
      userId,
      `cat "${containerPath}"`
    );

    // 使用 demuxStream 来正确处理 Docker 的多路复用协议
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
          return;
        }

        // Trim trailing whitespace and strip UTF-8 BOM
        let trimmedContent = content.replace(/\s+$/, '');
        const charCode = trimmedContent.charCodeAt(0);
        if (charCode === 0xFEFF || trimmedContent.startsWith('\uFEFF')) {
          trimmedContent = trimmedContent.slice(1);
        }

        resolve({
          content: trimmedContent,
          path: containerPath
        });
      });
    });
  }
}

export default FileReader;
