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

/** readme 读写流式超时（ms）。readme 是简单 cat/heredoc，正常 <1s，30s 足够区分挂死，
 *  避免与缺口 1 同型的「stream 永不 end → 摘要链路永久 pending」。 */
const README_STREAM_TIMEOUT_MS = 30_000;

/**
 * 项目文档索引管理服务
 * 读写容器内 readme.md，提供条目级别的增删改查
 */
export class ReadmeService {
  constructor() {
    /** @type {Map<string, {content: string|null, timestamp: number}>} */
    this._cache = new Map();
    /** per-project 写操作串行队列尾 Promise，避免并发 read-modify-write 覆盖（Bug 2） */
    this._writeChains = new Map();
  }

  /**
   * 串行化同一项目的 readme 写操作。
   * appendEntry/removeEntry/updateSummary 都是 read-modify-write（先 readReadme 再 _writeReadme）。
   * 两个 generateSummary 并发 appendEntry 时会读到同一旧内容、后写覆盖先写 → 条目丢失（Bug 2）。
   * 用 Promise 链排队保证写串行；任务错误向上抛给调用方，但不阻断后续写。
   * @private
   */
  _serializeWrite(key, task) {
    const prev = this._writeChains.get(key) ?? Promise.resolve();
    const next = prev.then(task, task);
    // 链尾存 swallow 版，保证前一个失败不断裂后续写
    this._writeChains.set(key, next.catch(() => {}));
    return next;
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
  async appendEntry(userId, projectName, { fileName, fileSize, summary, status }) {
    return this._serializeWrite(this._cacheKey(userId, projectName), () =>
      this._appendEntryCore(userId, projectName, { fileName, fileSize, summary, status }));
  }

  /**
   * appendEntry 的核心逻辑（不加锁），供 appendEntry 与 updateSummary 的 append-if-missing 复用。
   * 调用方必须已持有 _serializeWrite 锁（updateSummary 在锁内直接调它，避免嵌套加锁死锁）。
   * @private
   */
  async _appendEntryCore(userId, projectName, { fileName, fileSize, summary, status }) {
    const existing = (await this.readReadme(userId, projectName)) || '# 项目文档索引\n';
    const sizeStr = this._formatSize(fileSize);
    const dateStr = new Date().toISOString().split('T')[0];

    // 失败条目追加状态行，供 parseEntries 识别为 error；成功/省略时不写（向后兼容旧格式）
    const statusLine = status === 'failed' ? '\n- 状态: 失败' : '';
    const section = `\n\n## ${fileName}\n- 大小: ${sizeStr}\n- 上传时间: ${dateStr}\n- 摘要: ${summary}${statusLine}\n`;
    const newContent = existing.trimEnd() + section;

    await this._writeReadme(userId, projectName, newContent);
    this.invalidateCache(userId, projectName);
    logger.info({ userId, projectName, fileName, status: status || 'ready' }, '[ReadmeService] 条目已追加');
  }

  /**
   * 删除匹配文件名的条目
   * @param {number} userId
   * @param {string} projectName
   * @param {string} fileName
   */
  async removeEntry(userId, projectName, fileName) {
    return this._serializeWrite(this._cacheKey(userId, projectName), async () => {
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
    });
  }

  /**
   * 更新指定文件的摘要文本
   * @param {number} userId
   * @param {string} projectName
   * @param {string} fileName
   * @param {string} newSummary
   */
  async updateSummary(userId, projectName, fileName, newSummary) {
    return this._serializeWrite(this._cacheKey(userId, projectName), async () => {
      const existing = await this.readReadme(userId, projectName);

      // 条目不存在（如前端 local-error 兜底态：后端无条目但用户手动填写）→ 创建 ready 条目
      // 已在锁内，直接调 _appendEntryCore（不再加锁，避免嵌套死锁）
      if (!existing || !this._hasSection(existing, fileName)) {
        await this._appendEntryCore(userId, projectName, { fileName, fileSize: 0, summary: newSummary });
        logger.info({ userId, projectName, fileName }, '[ReadmeService] 条目不存在，已创建');
        return;
      }

      const sections = this._splitSections(existing);
      const updated = sections.map(section => {
        if (section.startsWith(`## ${fileName}\n`)) {
          return section
            .replace(/^- 摘要:.*$/m, `- 摘要: ${newSummary}`)
            // 手动编辑 → 转为 ready，清除失败状态行（\n? 吃掉行尾换行避免空行）
            .replace(/^- 状态:.*$\n?/m, '');
        }
        return section;
      }).join('\n\n');

      await this._writeReadme(userId, projectName, updated);
      this.invalidateCache(userId, projectName);
      logger.info({ userId, projectName, fileName }, '[ReadmeService] 摘要已更新');
    });
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
        const statusMatch = section.match(/^- 状态:\s*(.+)$/m);
        const rawStatus = statusMatch ? statusMatch[1].trim() : null;
        return {
          fileName,
          summary: summaryMatch ? summaryMatch[1].trim() : null,
          // 失败标记 → 'error'；旧条目无状态行 → 'ready'（向后兼容）
          status: rawStatus === '失败' ? 'error' : 'ready',
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
   * 判断 readme 中是否已存在指定文件名的段落
   * @param {string} content - readme.md 全文
   * @param {string} fileName - 文件名
   * @returns {boolean}
   * @private
   */
  _hasSection(content, fileName) {
    return this._splitSections(content).some(s => s.startsWith(`## ${fileName}\n`));
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
    // 使用唯一分隔符防止 AI 生成的摘要内容中碰巧包含分隔符导致截断
    const delimiter = `README_EOF_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tmpPath = `${dir}/.readme.tmp`;
    const writeCmd = [
      'sh', '-c',
      `cat > '${tmpPath}' << '${delimiter}'\n${content}\n${delimiter}\nmv '${tmpPath}' '${filePath}'`
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
  async _execCommand(userId, cmd, timeoutMs = README_STREAM_TIMEOUT_MS) {
    const { stream } = await containerManager.execInContainer(userId, cmd);
    // demux 是必须的：分离 stdout/stderr，否则 stream 可能不触发 'end'
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);
    // 消费 stderr，避免背压阻塞 stream
    stderr.on('data', () => {});
    return new Promise((resolve, reject) => {
      // 超时兜底：heredoc 写入等命令挂死时 stream 永不 end，会让 appendEntry 永久 pending。
      const timer = setTimeout(() => {
        stream.destroy();
        reject(new Error(`readme exec stream timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      stream.on('error', (err) => { clearTimeout(timer); reject(err); });
      stream.on('end', () => { clearTimeout(timer); resolve(); });
    });
  }

  /**
   * 读取 Docker stream 输出
   * @private
   */
  _readStream(stream, timeoutMs = README_STREAM_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      const chunks = [];
      stdout.on('data', (chunk) => chunks.push(chunk));
      stderr.on('data', () => {}); // consume stderr

      // 超时兜底：cat 挂死时 stream 永不 end，readReadme 会永久 pending。
      const timer = setTimeout(() => {
        stream.destroy();
        reject(new Error(`readme read stream timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      stream.on('end', () => {
        clearTimeout(timer);
        const output = Buffer.concat(chunks).toString('utf-8');
        resolve(output);
      });
      stream.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
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
