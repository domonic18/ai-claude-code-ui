/**
 * 容器文件读取模块
 *
 * 封装通过 Docker exec 从容器内读取和写入文件的操作。
 * 处理 Docker 多路复用协议（demuxStream），提供简洁的文件 I/O 接口。
 *
 * @module sessions/container/containerFileReader
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { writeFileViaPutArchive as writeFileToContainerArchive, writeFileViaShell as writeShell, validateFilePath } from '../../container/utils/containerFileWriter.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/sessions/container/containerFileReader');

/** Docker exec 读取文件默认超时时间（毫秒） */
const READ_FILE_TIMEOUT_MS = 30000;

// containerFileReader.js 功能函数
/**
 * 从容器内读取文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内文件路径
 * @returns {Promise<string>} 文件内容
 * @throws {Error} 文件不存在或读取失败，或超时
 */
export async function readFileFromContainer(userId, filePath) {
  const { stream } = await containerManager.execInContainer(
    userId,
    ['cat', filePath]
  );

  // 使用 demuxStream 来正确处理 Docker 的多路复用协议
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  return new Promise((resolve, reject) => {
    let content = '';
    let errorOutput = '';
    let settled = false;

    const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
    const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };

    const timer = setTimeout(() => {
      safeReject(new Error(`Docker exec timed out after ${READ_FILE_TIMEOUT_MS}ms while reading: ${filePath}`));
    }, READ_FILE_TIMEOUT_MS);

    stdout.on('data', (chunk) => {
      content += chunk.toString();
    });

    stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    stream.on('error', (err) => {
      clearTimeout(timer);
      safeReject(new Error(`Failed to read file: ${err.message}`));
    });

    stream.on('end', () => {
      clearTimeout(timer);
      if (errorOutput && (errorOutput.includes('No such file') || errorOutput.includes('cannot access'))) {
        safeReject(new Error(`File not found: ${filePath}`));
      } else {
        safeResolve(content);
      }
    });
  });
}

// containerFileReader.js 功能函数
/**
 * 将 JSONL 内容写回容器文件
 * 根据内容大小自动选择写入策略：小文件使用 base64+shell，大文件使用 putArchive。
 *
 * @param {number} userId - User ID
 * @param {string} filePath - 容器内文件路径
 * @param {Array} entries - 要写入的条目数组
 * @returns {Promise<void>}
 */
export async function writeJsonlContentToContainer(userId, filePath, entries) {
  // 安全校验：防止路径包含危险字符
  validateFilePath(filePath);

  // 重建 JSONL 内容
  const updatedContent = entries
    .map(entry => entry._raw || JSON.stringify(entry))
    .filter(line => line.trim())
    .join('\n') + '\n';

  const contentSize = Buffer.byteLength(updatedContent, 'utf8');

  // 阈值 80KB：base64 膨胀 ~33%，80KB 编码后约 107KB，
  // 留出余量避免接近 Linux exec 的 ~128KB 参数长度限制
  const SHELL_ARG_SIZE_THRESHOLD = 80 * 1024;

  if (contentSize > SHELL_ARG_SIZE_THRESHOLD) {
    // 大文件：通过 Docker putArchive API 写入，完全绕过命令行参数长度限制
    const container = await containerManager.getOrCreateContainer(userId);
    const dockerContainer = containerManager.docker.getContainer(container.id);
    await writeFileToContainerArchive(dockerContainer, filePath, updatedContent, { logLabel: 'containerFileReader' });
  } else {
    // 小文件：使用 base64 编码写入（原有逻辑，已验证可正常工作）
    await writeShell(containerManager, userId, filePath, updatedContent);
  }
}

// containerFileReader.js 功能函数
/**
 * 在容器内执行命令并收集 stdout 输出
 * @param {number} userId - 用户 ID
 * @param {string[]} cmd - 要执行的命令
 * @param {Object} [options] - 选项
 * @param {boolean} [options.silentStderr] - 是否静默处理 stderr
 * @param {string} [options.logLabel] - 日志标签前缀
 * @returns {Promise<string>} stdout 输出内容
 */
export async function execAndCollectOutput(userId, cmd, options = {}) {
  const { stream } = await containerManager.execInContainer(userId, cmd);

  const stdout = new PassThrough();
  const stderr = new PassThrough();

  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';

    stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
      if (options.logLabel && !options.silentStderr) {
        logger.info(`[${options.logLabel}] STDERR:`, chunk.toString());
      }
    });

    stream.on('error', () => {
      resolve('');
    });

    stream.on('end', () => {
      resolve(output);
    });
  });
}
