/**
 * DocumentTextExtractor.js
 *
 * 文档文本提取器
 * 从 Docker 容器内提取文档的文本内容，供 AI 摘要生成使用。
 *
 * 支持格式：
 * - PDF  → pdftotext (poppler-utils)
 * - DOCX / DOC → pandoc
 * - 其他（txt/md/csv/json/代码）→ cat
 *
 * @module services/documents/DocumentTextExtractor
 */

import containerManager from '../container/core/index.js';
import { createLogger } from '../../utils/logger.js';
import { PassThrough } from 'stream';
import path from 'path';

const logger = createLogger('services/documents/DocumentTextExtractor');

/** 默认最大提取字符数，控制 token 成本 */
const DEFAULT_MAX_CHARS = 4000;

/**
 * 根据文件扩展名选择提取命令
 * @param {string} filePath - 容器内文件路径
 * @param {string} fileName - 文件名
 * @returns {string[]} 容器内执行的命令数组
 */
function getExtractCommand(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case '.pdf':
      return ['sh', '-c', `pdftotext -layout '${filePath}' - 2>/dev/null || echo "[pdftotext failed]"`];
    case '.docx':
    case '.doc':
      return ['sh', '-c', `pandoc '${filePath}' -t plain -o - 2>/dev/null || echo "[pandoc failed]"`];
    default:
      return ['cat', filePath];
  }
}

/**
 * 文档文本提取器
 * 通过容器内命令行工具提取文档文本内容
 */
export class DocumentTextExtractor {
  /**
   * 从容器内提取文档文本
   * @param {number} userId - 用户 ID
   * @param {string} filePath - 容器内文件路径
   * @param {string} fileName - 文件名（用于判断文件类型）
   * @param {{maxChars?: number}} [options] - 可选配置
   * @returns {Promise<string>} 提取的文本内容
   */
  async extractText(userId, filePath, fileName, options = {}) {
    const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

    // 图片文件不支持文本提取，直接返回提示
    const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
    const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
    if (IMAGE_EXTS.has(ext)) {
      return `[图片文件，无法提取文本: ${fileName}]`;
    }

    try {
      await containerManager.getOrCreateContainer(userId);
      const cmd = getExtractCommand(filePath, fileName);
      const raw = await this._execOutput(userId, cmd);

      if (!raw || !raw.trim()) {
        logger.warn({ userId, fileName }, '[TextExtractor] 提取结果为空');
        return `[文档内容为空或无法提取: ${fileName}]`;
      }

      // 截断到最大字符数
      const truncated = raw.length > maxChars
        ? raw.slice(0, maxChars) + '\n\n...[内容已截断]'
        : raw;

      logger.info({
        userId,
        fileName,
        rawLength: raw.length,
        truncatedLength: truncated.length,
      }, '[TextExtractor] 文本提取成功');

      return truncated;
    } catch (err) {
      logger.error({ err, userId, filePath, fileName }, '[TextExtractor] 文本提取失败');
      return `[无法提取文档内容: ${fileName}]`;
    }
  }

  /**
   * 执行容器命令并返回 stdout
   * @private
   */
  async _execOutput(userId, cmd) {
    const { stream } = await containerManager.execInContainer(userId, cmd);
    return this._readStream(stream);
  }

  /**
   * 读取 Docker stream
   * @private
   */
  _readStream(stream) {
    return new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      const chunks = [];
      stdout.on('data', (chunk) => chunks.push(chunk));
      stderr.on('data', () => {});

      stream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      stream.on('error', reject);
    });
  }
}

/** 单例导出 */
export const documentTextExtractor = new DocumentTextExtractor();
export default documentTextExtractor;
