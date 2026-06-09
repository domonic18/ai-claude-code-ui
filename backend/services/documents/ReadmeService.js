/**
 * ReadmeService.js
 *
 * 项目文档索引管理服务
 * 管理容器内 /workspace/{project}/readme.md 文件，
 * 为每个文档（上传 + AI 生成）维护 AI 摘要条目。
 *
 * readme.md 格式：
 * # 项目文档索引
 *
 * ## 文件名.pdf
 * - 大小: 2.3MB
 * - 上传时间: 2026-06-08
 * - 摘要: 本发明涉及...
 *
 * @module services/documents/ReadmeService
 */

import containerManager from '../container/core/index.js';
import { createLogger } from '../../utils/logger.js';
import { PassThrough } from 'stream';

const logger = createLogger('services/documents/ReadmeService');

/** readme.md 文件名 */
const README_FILENAME = 'readme.md';
const CACHE_TTL_MS = 10_000;

/**
 * 项目文档索引管理服务
 * 读写容器内 readme.md，提供条目级别的增删改查
 */
export class ReadmeService {
  constructor() {
    /** @type {Map<string, {content: string|null, timestamp: number}>} */
    this._cache = new Map();
  }

  // ─── 公开方法 ───────────────────────────────────────

  /**
   * 读取 readme.md 全文
   * @param {number} userId
   * @param {string} projectName
   * @returns {Promise<string|null>} 内容，不存在返回 null
   */
  async readReadme(userId, projectName) {
    const key = this._cacheKey(userId, projectName);
    const cached = this._cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.content;
    }

    const containerPath = `/workspace/${projectName}/${README_FILENAME}`;
    try {
      await containerManager.getOrCreateContainer(userId);
      const content = await this._readFile(userId, containerPath);
      const trimmed = content?.trim() || null;

      this._cache.set(key, { content: trimmed, timestamp: Date.now() });
      return trimmed;
    } catch (err) {
      logger.warn({ err, userId, projectName }, '[ReadmeService] 读取 readme.md 失败，视为空文件');
      this._cache.set(key, { content: null, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * 追加一个文档条目到 readme.md
   * @param {number} userId
   * @param {string} projectName
   * @param {{fileName: string, fileSize: number, summary: string}} entry
   */
  async appendEntry(userId, projectName, { fileName, fileSize, summary }) {
    const existing = (await this.readReadme(userId, projectName)) || '# 项目文档索引\n';
    const sizeStr = this._formatSize(fileSize);
    const dateStr = new Date().toISOString().split('T')[0];

    const section = `\n\n## ${fileName}\n- 大小: ${sizeStr}\n- 上传时间: ${dateStr}\n- 摘要: ${summary}\n`;
    const newContent = existing.trimEnd() + section;

    await this._writeReadme(userId, projectName, newContent);
    this.invalidateCache(userId, projectName);
    logger.info({ userId, projectName, fileName }, '[ReadmeService] 条目已追加');
  }

  /**
   * 删除匹配文件名的条目
   * @param {number} userId
   * @param {string} projectName
   * @param {string} fileName
   */
  async removeEntry(userId, projectName, fileName) {
    const existing = await this.readReadme(userId, projectName);
    if (!existing) return;

    const newContent = this._removeSection(existing, fileName);
    if (newContent === existing) {
      logger.debug({ userId, projectName, fileName }, '[ReadmeService] 未找到匹配条目，跳过删除');
      return;
    }

    await this._writeReadme(userId, projectName, newContent);
    this.invalidateCache(userId, projectName);
    logger.info({ userId, projectName, fileName }, '[ReadmeService] 条目已删除');
  }

  /**
   * 更新指定文件的摘要文本
   * @param {number} userId
   * @param {string} projectName
   * @param {string} fileName
   * @param {string} newSummary
   */
  async updateSummary(userId, projectName, fileName, newSummary) {
    const existing = await this.readReadme(userId, projectName);
    if (!existing) {
      logger.warn({ userId, projectName, fileName }, '[ReadmeService] readme.md 不存在，无法更新摘要');
      return;
    }

    const sections = this._splitSections(existing);
    const updated = sections.map(section => {
      if (section.startsWith(`## ${fileName}\n`)) {
        return section.replace(/^- 摘要:.*$/m, `- 摘要: ${newSummary}`);
      }
      return section;
    }).join('\n\n');

    await this._writeReadme(userId, projectName, updated);
    this.invalidateCache(userId, projectName);
    logger.info({ userId, projectName, fileName }, '[ReadmeService] 摘要已更新');
  }

  /**
   * 解析所有条目，返回文件名→摘要映射
   * @param {number} userId
   * @param {string} projectName
   * @returns {Promise<Array<{fileName: string, summary: string|null}>>}
   */
  async parseEntries(userId, projectName) {
    const content = await this.readReadme(userId, projectName);
    if (!content) return [];

    const sections = this._splitSections(content);
    return sections
      .filter(s => s.startsWith('## '))
      .map(section => {
        const firstLine = section.split('\n')[0]; // ## filename
        const fileName = firstLine.replace(/^## /, '').trim();
        const summaryMatch = section.match(/^- 摘要:\s*(.+)$/m);
        return {
          fileName,
          summary: summaryMatch ? summaryMatch[1].trim() : null,
        };
      });
  }

  /**
   * 清除缓存
   * @param {number} userId
   * @param {string} projectName
   */
  invalidateCache(userId, projectName) {
    this._cache.delete(this._cacheKey(userId, projectName));
  }

  // ─── 私有方法 ───────────────────────────────────────

  /**
   * 将 readme.md 切分为段落（header + 各 H2 段落）
   * @param {string} content
   * @returns {string[]} 段落数组
   */
  _splitSections(content) {
    // 按 \n## 切分，保留 header 段落
    const parts = content.split(/\n(?=## )/);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  /**
   * 移除匹配文件名的 H2 段落
   *
   * 使用 _splitSections 切分后过滤，避免正则贪婪匹配误吞相邻段落的换行符。
   * 原正则方案 `\n*## X\n(?:(?!## )[^])*` 会把前后换行一起吃掉，
   * 导致下一段 `## Y` 与 header 行粘连，parseEntries 无法识别。
   *
   * @param {string} content - 原始 readme.md 内容
   * @param {string} fileName - 要移除的文件名
   * @returns {string} 移除后的内容
   */
  _removeSection(content, fileName) {
    const sections = this._splitSections(content);
    const targetPrefix = `## ${fileName}\n`;
    const filtered = sections.filter(s => !s.startsWith(targetPrefix));
    return filtered.join('\n\n').trimEnd();
  }

  /**
   * 格式化文件大小
   * @param {number} bytes
   * @returns {string}
   */
  _formatSize(bytes) {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * 将内容写入容器内的 readme.md
   * @private
   */
  async _writeReadme(userId, projectName, content) {
    await containerManager.getOrCreateContainer(userId);
    const dir = `/workspace/${projectName}`;
    const filePath = `${dir}/${README_FILENAME}`;

    // 确保目录存在
    await this._execCommand(userId, ['mkdir', '-p', dir]);

    // 使用 heredoc 写入，避免 shell 转义问题
    // 先写到一个临时文件再 mv，避免部分写入
    const tmpPath = `${dir}/.readme.tmp`;
    const writeCmd = [
      'sh', '-c',
      `cat > '${tmpPath}' << 'README_EOF'\n${content}\nREADME_EOF\nmv '${tmpPath}' '${filePath}'`
    ];
    await this._execCommand(userId, writeCmd);
  }

  /**
   * 从容器读取文件内容
   * @private
   */
  async _readFile(userId, filePath) {
    const { stream } = await containerManager.execInContainer(userId, ['cat', filePath]);
    return this._readStream(stream);
  }

  /**
   * 在容器内执行命令并等待完成
   *
   * Docker exec 在 Tty:false 模式下返回多路复用流，
   * 必须调用 demuxStream 才能正确触发 stream 的 'end' 事件。
   * 否则 Promise 会永远 pending，导致 appendEntry/removeEntry 挂住。
   *
   * @private
   */
  async _execCommand(userId, cmd) {
    const { stream } = await containerManager.execInContainer(userId, cmd);
    // demux 是必须的：分离 stdout/stderr，否则 stream 可能不触发 'end'
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);
    // 消费 stderr，避免背压阻塞 stream
    stderr.on('data', () => {});
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve());
    });
  }

  /**
   * 读取 Docker stream 输出
   * @private
   */
  _readStream(stream) {
    return new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      const chunks = [];
      stdout.on('data', (chunk) => chunks.push(chunk));
      stderr.on('data', () => {}); // consume stderr

      stream.on('end', () => {
        const output = Buffer.concat(chunks).toString('utf-8');
        resolve(output);
      });
      stream.on('error', reject);
    });
  }

  /**
   * 缓存 key
   * @private
   */
  _cacheKey(userId, projectName) {
    return `${userId}:${projectName}`;
  }
}

/** 单例导出 */
export const readmeService = new ReadmeService();
export default readmeService;
