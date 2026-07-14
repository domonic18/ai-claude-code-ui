/**
 * DocumentService.js
 *
 * 文档管理服务
 * 基于文件方式管理项目文档（零数据库变更）
 * - 用户上传文档：扫描 <project>/documents/uploads/ 目录
 * - AI 生成文档：读写 <project>/documents/.ai-documents.json 清单文件
 *
 * @module services/documents/DocumentService
 */

import containerManager from '../container/core/index.js';
import { createLogger } from '../../utils/logger.js';
import { PassThrough } from 'stream';
import { summaryService } from './SummaryService.js';
import { readmeService } from './ReadmeService.js';
import { validateContainerPath, validateProjectFilePath, validateProjectName } from '../../utils/pathValidator.js';
import { writeFileViaPutArchive } from '../container/utils/containerFileWriter.js';
import { GENERATED_DIR_NAME } from '../../config/containerConfig.js';

const logger = createLogger('services/documents/DocumentService');

/** 文档目录在容器内的相对路径 */
const DOCUMENTS_DIR = 'documents';
const UPLOADS_SUBDIR = 'uploads';
const GENERATED_DIR = GENERATED_DIR_NAME;
const AI_MANIFEST_FILE = '.ai-documents.json';

/**
 * 文档列表内存缓存（避免短时间内重复全量扫描）。
 * 进程内 Map，多进程部署下各进程独立缓存；当前单容器单进程无影响，改多进程需迁移 Redis。
 */
const DOC_CACHE_TTL_MS = 5_000;
const DOC_CACHE_MAX_SIZE = 500;
const documentCache = new Map();

/**
 * 正在生成摘要的 AI 文档 key 集合（兜底补触发去重用）。
 * key 形如 `${userId}:${projectName}:${fileName}`。
 * readme.appendEntry 不去重，必须用此锁防止轮询期间对同一 pending 文档重复触发，
 * 否则会在 readme.md 写出多个重复条目。摘要生成结束（成功或兜底）后自动释放。
 * 注：进程内 Set，多进程部署（PM2 cluster）下不共享、去重会失效，需改用 Redis 分布式锁。
 */
const pendingSummaryKeys = new Set();

/**
 * 根据 readme 条目派生文档的摘要状态与文本。
 * - 有条目且 status==='error' → 'error'
 * - 有条目 → 'ready'
 * - 无条目 → 'pending'
 * @param {Object} doc - 目录扫描得到的文档项
 * @param {Array<{fileName:string,summary:string|null,status:string}>} readmeEntries
 * @returns {Object} 附加了 summary_status / summary 的文档项
 */
function enrichDoc(doc, readmeEntries) {
  const entry = readmeEntries.find(e => e.fileName === doc.file_name);
  return {
    ...doc,
    summary_status: entry ? (entry.status === 'error' ? 'error' : 'ready') : 'pending',
    summary: entry?.summary || null,
  };
}

/** 使指定项目的文档列表缓存失效 */
function invalidateDocCache(userId, projectName) {
  documentCache.delete(`${userId}:${projectName}`);
}

/** 写入缓存前检查大小上限，超过时清空最旧的条目 */
function setDocCache(cacheKey, data) {
  if (documentCache.size >= DOC_CACHE_MAX_SIZE) {
    // Map 按插入顺序迭代，删除最早的条目释放空间
    const oldestKey = documentCache.keys().next().value;
    documentCache.delete(oldestKey);
  }
  documentCache.set(cacheKey, { data, time: Date.now() });
}

/**
 * 文档管理服务
 * 在用户 Docker 容器内管理项目文档的元数据和文件操作
 */
export class DocumentService {
  /**
   * 获取项目下所有文档（用户上传 + AI 生成）
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称（目录名）
   * @returns {Promise<{uploads: Array, aiGenerated: Array}>}
   */
  async getProjectDocuments(userId, projectName) {
    // 5 秒内直接返回缓存，避免重复全量扫描
    const cacheKey = `${userId}:${projectName}`;
    const cached = documentCache.get(cacheKey);
    if (cached && Date.now() - cached.time < DOC_CACHE_TTL_MS) {
      logger.debug({ userId, projectName, cacheAge: Date.now() - cached.time }, '[getProjectDocuments] 命中缓存');
      return cached.data;
    }

    const [uploads, aiManifest, generatedFiles, readmeEntries] = await Promise.all([
      this._scanUploads(userId, projectName),
      this._readAIManifest(userId, projectName),
      this._scanGeneratedDir(userId, projectName),
      readmeService.parseEntries(userId, projectName),
    ]);

    // 合并去重：manifest 记录 + 目录扫描结果（以 file_path 为唯一键）
    const aiGenerated = this._mergeDocuments(aiManifest, generatedFiles);

    // 为 uploads 附加摘要状态和内容
    const enrichedUploads = uploads.map(upload => enrichDoc(upload, readmeEntries));

    // 为 AI 生成文档也附加摘要状态
    const enrichedAiGenerated = aiGenerated.map(doc => enrichDoc(doc, readmeEntries));

    logger.info({
      projectName,
      readmeEntries: readmeEntries.map(e => e.fileName),
      uploads: enrichedUploads.map(u => ({ name: u.file_name, status: u.summary_status })),
      aiGenerated: enrichedAiGenerated.map(d => ({ name: d.file_name, status: d.summary_status })),
    }, '[getProjectDocuments] 文档摘要状态');

    const result = { uploads: enrichedUploads, aiGenerated: enrichedAiGenerated };
    setDocCache(cacheKey, result);

    // 兜底：为「没人管」的 pending AI 文档补触发摘要生成。
    // 正常路径下 Write 工具会触发 recordAIDocument→摘要；但任何绕过追踪的写入
    // （或追踪失败）会让文档永久卡 pending。这里幂等补一次，保证最终收敛到 ready。
    this._recoverPendingAISummaries(userId, projectName, enrichedAiGenerated);

    return result;
  }

  /**
   * 失效文档列表缓存（供 Controller 在直接改 readme 后调用，如手动编辑摘要）。
   * getProjectDocuments 有 5s 内存缓存（DOC_CACHE_TTL_MS），直接改 readme 而不清缓存，
   * 会让前端 refetch 拿到旧 summary_status（手动填写 error 后仍显示红色，Bug 1）。
   * @param {number} userId
   * @param {string} projectName
   */
  invalidateDocumentsCache(userId, projectName) {
    invalidateDocCache(userId, projectName);
  }

  /**
   * 兜底补触发：为 summary_status 仍为 pending 的 AI 文档补一次摘要生成。
   *
   * 仅作用于 AI 生成文档（上传文档在 uploadDocument 时已触发，且文件立即可读、
   * 有兜底摘要，不会卡 pending）。用 pendingSummaryKeys 做 in-flight 去重，
   * 保证轮询期间对同一文档只触发一次；生成完成后（成功或写入兜底摘要）释放锁，
   * 下次若仍 pending 才会重试。
   *
   * @private
   * @param {number} userId
   * @param {string} projectName
   * @param {Array<Object>} aiDocs - 已附加 summary_status 的 AI 文档列表
   */
  _recoverPendingAISummaries(userId, projectName, aiDocs) {
    for (const doc of aiDocs) {
      if (doc.summary_status !== 'pending') continue;

      const key = `${userId}:${projectName}:${doc.file_name}`;
      if (pendingSummaryKeys.has(key)) continue;
      pendingSummaryKeys.add(key);

      logger.info(
        { userId, projectName, fileName: doc.file_name },
        '[DocumentService] 兜底补触发 AI 文档摘要（目录扫描发现 pending）'
      );

      // generateSummary 返回的 promise 永不 reject（内部已兜底），可安全 .finally
      summaryService.generateSummary(userId, projectName, {
        file_path: doc.file_path,
        file_name: doc.file_name,
        file_size: doc.file_size || 0,
        source: 'ai',
      }).finally(() => pendingSummaryKeys.delete(key));
    }
  }

  /**
   * 上传文档到项目的 documents/uploads/ 目录
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @param {Object} file - multer 文件对象 { buffer, originalname, size, mimetype }
   * @returns {Promise<Object>} 上传结果
   */
  async uploadDocument(userId, projectName, file) {
    const uploadDir = `${DOCUMENTS_DIR}/${UPLOADS_SUBDIR}`;
    const containerBasePath = `/workspace/${projectName}`;
    const containerDir = `${containerBasePath}/${uploadDir}`;

    logger.info({ userId, projectName, originalName: file.originalname, fileSize: file.size }, '[文档上传] Service 开始处理');

    // 确保容器存在
    await containerManager.getOrCreateContainer(userId);
    logger.info({ userId }, '[文档上传] 容器已就绪');

    // 确保目录存在
    await this._execCommand(userId, ['mkdir', '-p', containerDir]);
    logger.info({ userId, containerDir }, '[文档上传] 目录已创建');

    // 修复 multer 传递的文件名编码（UTF-8 字节被错误按 Latin-1 解码）
    const fixedName = this._fixFilename(file.originalname);
    // 清理非法字符并分离基础名/扩展名
    const { baseName, ext } = this._sanitizeFilename(fixedName);
    // 解析不冲突的文件名：同名时自动追加 _1、_2… 序号，避免覆盖丢数据
    const safeName = await this._resolveUniqueName(userId, containerDir, baseName, ext);
    const containerFilePath = `${containerDir}/${safeName}`;
    logger.info({ userId, safeName, containerFilePath }, '[文档上传] 安全文件名已生成');

    // 将文件写入容器
    try {
      await this._writeFileToContainer(userId, containerFilePath, file.buffer);
      logger.info({ userId, containerFilePath }, '[文档上传] 文件已写入容器');
    } catch (writeErr) {
      logger.error({ err: writeErr, userId, containerFilePath }, '[文档上传] 写入容器失败');
      throw writeErr;
    }

    logger.info({ userId, projectName, file: safeName }, '文档上传成功');

    // 上传成功后立即失效缓存，确保后续列表查询返回最新数据
    invalidateDocCache(userId, projectName);

    // 异步生成 AI 摘要（fire-and-forget，不阻塞上传响应）
    summaryService.generateSummary(userId, projectName, {
      file_path: containerFilePath,
      file_name: safeName,
      file_size: file.size,
      source: 'upload',
    });

    return {
      file_name: safeName,
      file_path: containerFilePath,
      file_size: file.size,
      mime_type: file.mimetype,
      type: 'upload',
      created_at: new Date().toISOString(),
      summary_status: 'pending',
    };
  }

  /**
   * 删除文档
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @param {string} filePath - 文件路径
   * @param {string} docType - 文档类型 'upload' | 'ai_generated'
   * @returns {Promise<boolean>}
   */
  async deleteDocument(userId, projectName, filePath, docType) {
    await containerManager.getOrCreateContainer(userId);

    // 安全校验：确保路径在项目目录内（normalize 防止 .. 遍历）
    const pathCheck = validateProjectFilePath(filePath, projectName);
    if (!pathCheck.valid) {
      throw new Error(pathCheck.error);
    }

    // 删除文件
    await this._execCommand(userId, ['rm', '-f', filePath]);

    // 如果是上传文档，从 readme.md 中移除摘要条目
    if (docType === 'upload') {
      const fileName = filePath.split('/').pop();
      await readmeService.removeEntry(userId, projectName, fileName).catch((err) => {
        logger.warn({ err, userId, projectName, fileName }, '从 readme.md 移除条目失败（非致命）');
      });
    }

    // 如果是 AI 生成文档，从 manifest 中移除，并移除 readme 条目
    if (docType === 'ai_generated') {
      await this._removeFromAIManifest(userId, projectName, filePath);
      const fileName = filePath.split('/').pop();
      await readmeService.removeEntry(userId, projectName, fileName).catch((err) => {
        logger.warn({ err, userId, projectName, fileName }, '从 readme.md 移除 AI 文档条目失败（非致命）');
      });
    }

    // 删除成功后立即失效缓存
    invalidateDocCache(userId, projectName);

    logger.info({ userId, projectName, filePath, docType }, '文档删除成功');
    return true;
  }

  /**
   * 重新生成文档摘要（用户点击「重新生成」时调用）
   *
   * 复用 pendingSummaryKeys 做 in-flight 去重（与 _recoverPendingAISummaries 互补互斥）：
   * regenerate 期间锁被持有，轮询触发的 recovery 看到 pending 但锁已占 → 跳过；连点幂等。
   * 先 removeEntry 清旧段落（避免 appendEntry 写出重复段落），再 fire-and-forget 触发生成。
   * removeEntry 失败则释放锁并抛错，不进入 generate —— 否则旧 failed 条目仍在，会产生重复段落。
   *
   * @param {number} userId
   * @param {string} projectName
   * @param {string} filePath - 容器内文件完整路径
   * @param {string} fileName - 文件名
   * @param {'upload'|'ai'} [source] - 文档来源，决定是否启用 AI 文档重试机制
   * @returns {Promise<{summary_status: 'pending'}>}
   */
  async regenerateSummary(userId, projectName, filePath, fileName, source) {
    const key = `${userId}:${projectName}:${fileName}`;
    // 已在生成中（regenerate 或 recovery 补触发），幂等返回 pending
    if (pendingSummaryKeys.has(key)) {
      return { summary_status: 'pending' };
    }
    pendingSummaryKeys.add(key);

    try {
      await readmeService.removeEntry(userId, projectName, fileName);
      invalidateDocCache(userId, projectName);
    } catch (err) {
      pendingSummaryKeys.delete(key);
      throw err;
    }

    logger.info({ userId, projectName, fileName, source }, '[DocumentService] 重新生成摘要');

    // 读取实际文件大小，保留 readme 条目的"大小"字段（避免重生成后显示"未知"）
    const fileSize = await this._getFileSize(userId, filePath);

    // fire-and-forget，锁在 .finally 释放（与 _recoverPendingAISummaries 同模式）
    summaryService.generateSummary(userId, projectName, {
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      source: source || 'upload',
    }).finally(() => pendingSummaryKeys.delete(key));

    return { summary_status: 'pending' };
  }

  /**
   * 读取容器内文件大小（字节数）。
   * 供 regenerateSummary 保留 readme 条目的"大小"字段。失败返回 0（显示"未知"），不阻断重新生成。
   * 通过 sh 位置参数 $1 传路径，避免文件名特殊字符被 shell 解释（同 _pathExists 模式）。
   * @private
   * @param {number} userId
   * @param {string} filePath - 容器内完整路径
   * @returns {Promise<number>}
   */
  async _getFileSize(userId, filePath) {
    try {
      const out = await this._execCommandOutput(userId, ['sh', '-c', 'wc -c < "$1"', '_', filePath]);
      return parseInt(out.trim(), 10) || 0;
    } catch (err) {
      logger.warn({ err, userId, filePath }, '[DocumentService] 读取文件大小失败，按"未知"处理');
      return 0;
    }
  }

  /**
   * 获取文档内容（用于预览）
   * @param {number} userId - 用户 ID
   * @param {string} filePath - 文件在容器内的完整路径
   * @returns {Promise<{content: string, mime_type: string}>}
   */
  async getDocumentContent(userId, filePath) {
    // 安全校验（normalize 防止 .. 遍历）
    const pathCheck = validateContainerPath(filePath);
    if (!pathCheck.valid) {
      throw new Error(pathCheck.error);
    }

    await containerManager.getOrCreateContainer(userId);

    // 读取文件内容（限制大小 5MB）
    const content = await this._readFileFromContainer(userId, filePath);

    return {
      content,
      mime_type: this._guessMimeType(filePath)
    };
  }

  /**
   * 保存文档内容（编辑后写回容器）
   * @param {number} userId - 用户 ID
   * @param {string} filePath - 文件在容器内的完整路径
   * @param {string} content - 新文件内容
   * @returns {Promise<void>}
   */
  async saveDocumentContent(userId, filePath, content) {
    const pathCheck = validateContainerPath(filePath);
    if (!pathCheck.valid) {
      throw new Error(pathCheck.error);
    }

    await containerManager.getOrCreateContainer(userId);
    await this._writeFileToContainer(userId, filePath, Buffer.from(content, 'utf-8'));

    logger.info({ userId, filePath }, '文档内容已保存');
  }

  /**
   * 记录 AI 生成的文档
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @param {Object} docInfo - 文档信息 { file_path, conversation_id, message_id }
   * @returns {Promise<void>}
   */
  async recordAIDocument(userId, projectName, docInfo) {
    const manifest = await this._readAIManifest(userId, projectName);

    // 避免重复记录
    const exists = manifest.some(d => d.file_path === docInfo.file_path);
    if (exists) {
      return;
    }

    const entry = {
      file_path: docInfo.file_path,
      file_name: this._extractFilename(docInfo.file_path),
      conversation_id: docInfo.conversation_id || null,
      message_id: docInfo.message_id || null,
      created_at: new Date().toISOString()
    };

    manifest.push(entry);
    await this._writeAIManifest(userId, projectName, manifest);

    // AI 文档记录后立即失效缓存
    invalidateDocCache(userId, projectName);

    // 异步生成 AI 文档摘要（fire-and-forget）
    summaryService.generateSummary(userId, projectName, {
      file_path: docInfo.file_path,
      file_name: entry.file_name,
      file_size: 0, // AI 文档大小未知，摘要里显示"未知"
      source: 'ai', // 显式标记 AI 文档，触发重试机制
    });

    logger.info({ userId, projectName, file: entry.file_name }, 'AI 文档已记录');
  }

  // ──────────────────── 私有方法 ────────────────────

  /**
   * 扫描 generated_docs/ 目录获取实际存在的文件
   * 作为 manifest 的兜底，确保 Bash 创建的文件也能被发现
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @returns {Promise<Array<DocumentItem>>}
   * @private
   */
  async _scanGeneratedDir(userId, projectName) {
    const dir = `/workspace/${projectName}/${GENERATED_DIR}`;
    return this._scanDirectory(userId, projectName, dir, 'ai_generated', 200);
  }

  /**
   * 合并 manifest 记录与目录扫描结果，去重
   * 以 file_path 为唯一键，manifest 记录优先（含 conversation_id 等元数据）
   * @param {Array} manifestDocs - manifest 中的文档记录
   * @param {Array} scannedDocs - 目录扫描到的文档
   * @returns {Array} 合并后的文档列表
   * @private
   */
  _mergeDocuments(manifestDocs, scannedDocs) {
    const merged = new Map();

    // 先放入目录扫描结果（作为基础）
    for (const doc of scannedDocs) {
      merged.set(doc.file_path, doc);
    }

    // manifest 记录覆盖（优先，因为含 conversation_id 等元数据）
    for (const doc of manifestDocs) {
      merged.set(doc.file_path, {
        ...merged.get(doc.file_path),
        ...doc,
        type: 'ai_generated'
      });
    }

    return Array.from(merged.values());
  }

  /**
   * 扫描 uploads 目录获取用户上传的文档列表
   * @private
   */
  async _scanUploads(userId, projectName) {
    const dir = `/workspace/${projectName}/${DOCUMENTS_DIR}/${UPLOADS_SUBDIR}`;
    return this._scanDirectory(userId, projectName, dir, 'upload', 100);
  }

  /**
   * 通用目录扫描方法
   * 在容器内扫描指定目录，获取文件列表及元数据
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称（仅用于日志）
   * @param {string} directory - 容器内目录路径
   * @param {'upload'|'ai_generated'} docType - 文档类型
   * @param {number} maxFiles - 最大文件数
   * @returns {Promise<Array>}
   * @private
   */
  async _scanDirectory(userId, projectName, directory, docType, maxFiles) {
    try {
      // 纵深防御：校验 projectName 和 directory 参数安全性
      const nameCheck = validateProjectName(projectName);
      if (!nameCheck.valid) {
        logger.warn({ userId, projectName, err: nameCheck.error }, '[scanDirectory] projectName 校验失败');
        return [];
      }
      const dirCheck = validateContainerPath(directory);
      if (!dirCheck.valid) {
        logger.warn({ userId, directory, err: dirCheck.error }, '[scanDirectory] directory 路径校验失败');
        return [];
      }

      await containerManager.getOrCreateContainer(userId);

      // 单次 find -printf 同时取「路径\t字节大小\tmtime」，避免逐文件多次 docker exec。
      // 原实现 N 个文件 = 1(find) + 2N(wc+stat) 次 docker exec（每次约 50ms），
      // 10 个文件约 1s；改为单次 exec 后约 60ms（~15× 提速）。
      // -printf 是 GNU find 扩展，sandbox 镜像为 GNU findutils 4.9.0，已验证可用。
      // %T@ 形如 1783038455.4403170060（epoch 秒.纳秒），parseInt 取整为秒。
      const output = await this._execCommandOutput(userId, [
        'sh', '-c',
        `find "${directory}" -type f -printf '%p\\t%s\\t%T@\\n' 2>/dev/null | head -${maxFiles}`,
      ]);

      if (!output || !output.trim()) {
        return [];
      }

      const results = [];
      for (const line of output.trim().split('\n')) {
        if (!line) continue;
        // 用 indexOf 定位前两个 tab 切分，比 split 更稳健（路径含 tab 极罕见）
        const tab1 = line.indexOf('\t');
        const tab2 = tab1 >= 0 ? line.indexOf('\t', tab1 + 1) : -1;
        if (tab1 < 0 || tab2 < 0) continue;

        const filePath = line.slice(0, tab1);
        const fileName = filePath.split('/').pop();

        // 排除隐藏文件（如 .ai-documents.json）和清单文件
        if (!fileName || fileName.startsWith('.') || fileName === AI_MANIFEST_FILE) continue;

        const size = parseInt(line.slice(tab1 + 1, tab2), 10) || 0;
        const mtimeSec = parseInt(line.slice(tab2 + 1), 10) || 0;

        results.push({
          file_name: fileName,
          file_path: filePath,
          file_size: size,
          type: docType,
          created_at: new Date(mtimeSec * 1000).toISOString(),
        });
      }
      return results;
    } catch (error) {
      logger.debug({ userId, projectName, directory, err: error }, `${docType} 目录扫描跳过`);
      return [];
    }
  }

  /**
   * 读取 AI 文档清单
   * 先尝试新路径（generated_docs/），失败则回退旧路径（documents/）并自动迁移
   * @private
   * @returns {Promise<Array>}
   */
  async _readAIManifest(userId, projectName) {
    const newPath = `/workspace/${projectName}/${GENERATED_DIR}/${AI_MANIFEST_FILE}`;

    try {
      await containerManager.getOrCreateContainer(userId);
      const content = await this._readFileFromContainer(userId, newPath);
      return JSON.parse(content);
    } catch {
      // 新路径不存在，尝试从旧路径迁移
    }

    // 迁移：从旧路径 documents/.ai-documents.json 读取并写入新路径
    const oldPath = `/workspace/${projectName}/${DOCUMENTS_DIR}/${AI_MANIFEST_FILE}`;
    try {
      const content = await this._readFileFromContainer(userId, oldPath);
      const manifest = JSON.parse(content);
      // 写入新路径
      await this._writeAIManifest(userId, projectName, manifest);
      // 删除旧文件
      await this._execCommand(userId, ['rm', '-f', oldPath]);
      logger.info({ userId, projectName }, '[DocumentService] 清单文件已从旧路径迁移到新路径');
      return manifest;
    } catch {
      return [];
    }
  }

  /**
   * 写入 AI 文档清单
   * @private
   */
  async _writeAIManifest(userId, projectName, manifest) {
    const dirPath = `/workspace/${projectName}/${GENERATED_DIR}`;
    const manifestPath = `${dirPath}/${AI_MANIFEST_FILE}`;

    await containerManager.getOrCreateContainer(userId);
    await this._execCommand(userId, ['mkdir', '-p', dirPath]);
    await this._writeFileToContainer(userId, manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)));
  }

  /**
   * 从 AI 文档清单中移除一条记录
   * @private
   */
  async _removeFromAIManifest(userId, projectName, filePath) {
    const manifest = await this._readAIManifest(userId, projectName);
    const filtered = manifest.filter(d => d.file_path !== filePath);
    await this._writeAIManifest(userId, projectName, filtered);
  }

  /**
   * 在容器内执行命令并等待完成
   * @private
   */
  async _execCommand(userId, cmd) {
    const { stream } = await containerManager.execInContainer(userId, cmd);
    // Docker exec 在 Tty:false 模式下返回多路复用流，必须 demux 才能正确触发 end 事件
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(err));
      stream.on('end', resolve);
    });
  }

  /**
   * 在容器内执行命令并获取输出
   * @private
   * @returns {Promise<string>}
   */
  async _execCommandOutput(userId, cmd) {
    const { stream } = await containerManager.execInContainer(userId, cmd);
    return this._readStreamOutput(stream);
  }

  /**
   * 从容器内读取文件内容
   * @private
   */
  async _readFileFromContainer(userId, filePath) {
    const { stream } = await containerManager.execInContainer(userId, ['cat', filePath]);
    return this._readStreamOutput(stream);
  }

  /**
   * 向容器内写入文件
   *
   * 复用 writeFileViaPutArchive（tar npm 包 + putArchive API），
   * 避免维护重复的容器文件写入逻辑。
   *
   * @param {number} userId - 用户 ID
   * @param {string} containerFilePath - 容器内文件路径
   * @param {Buffer} buffer - 文件内容
   * @private
   */
  async _writeFileToContainer(userId, containerFilePath, buffer) {
    const container = await containerManager.getOrCreateContainer(userId);
    const dockerContainer = containerManager.docker.getContainer(container.id);

    logger.info({ userId, containerFilePath, bufferSize: buffer.length, containerId: container.id }, '[文档上传] _writeFileToContainer 开始');

    await writeFileViaPutArchive(dockerContainer, containerFilePath, buffer, {
      logLabel: 'DocumentService',
    });

    logger.info({ userId, containerFilePath }, '[文档上传] 文件已写入容器');
  }

  /**
   * 读取 Docker exec stream 的输出
   * @private
   */
  _readStreamOutput(stream) {
    return new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      let output = '';
      stdout.on('data', (chunk) => { output += chunk.toString(); });
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(output));
    });
  }

  /**
   * 修复 multer 传递的文件名编码
   * multer/busboy 将 UTF-8 文件名错误按 Latin-1 解码，导致中文乱码
   * @private
   */
  _fixFilename(str) {
    try {
      // 检测是否包含 Latin-1 高位字节（0x80-0xFF），这是 mojibake 的标志
      if (/[\x80-\xff]/.test(str)) {
        return Buffer.from(str, 'latin1').toString('utf8');
      }
      return str;
    } catch {
      return str;
    }
  }

  /**
   * 清理文件名：去除非法字符、截断超长名，分离基础名与扩展名
   * 不再附加随机后缀（防同名覆盖改由 _resolveUniqueName 在容器侧处理，
   * 避免给所有文件名都加 _xxxxxx 乱码后缀）
   *
   * @private
   * @param {string} originalName - 原始文件名
   * @returns {{baseName: string, ext: string}} baseName 不含扩展名，ext 含前导点（如 '.md'），无扩展名时为空串
   */
  _sanitizeFilename(originalName) {
    // 允许：字母、数字、点、下划线、连字符、CJK 统一汉字、CJK 符号、全角字符
    const name = originalName.replace(/[^\w.\-一-鿿㐀-䶿　-〿＀-￯]/g, '_');
    const MAX_BASENAME = 60; // 基础文件名最大长度，避免 tar 路径超限
    const dotIndex = name.lastIndexOf('.');

    let baseName;
    let ext;
    if (dotIndex > 0) {
      ext = name.slice(dotIndex); // 含点，如 .docx
      baseName = name.slice(0, dotIndex);
    } else {
      baseName = name;
      ext = '';
    }

    if (baseName.length > MAX_BASENAME) {
      baseName = baseName.slice(0, MAX_BASENAME);
    }

    // 原名为空或仅含点号/非法字符时，baseName 可能为空或纯点号，
    // 会导致空文件名或形如 "dir/." 的非法路径。用默认名兜底。
    if (!baseName || /^\.+$/.test(baseName)) {
      baseName = '未命名';
    }

    return { baseName, ext };
  }

  /**
   * 解析目标目录内不冲突的文件名
   * 优先使用原始名；已存在则追加 _1、_2… 序号，序号耗尽回退时间戳兜底。
   * 这样单文件场景下文件名保持干净，同时仍能避免同名覆盖丢数据。
   *
   * @private
   * @param {number} userId - 用户 ID
   * @param {string} dir - 容器内目标目录
   * @param {string} baseName - 基础文件名（已清理、不含扩展名）
   * @param {string} ext - 扩展名（含前导点，如 '.md'）
   * @returns {Promise<string>} 不冲突的完整文件名
   */
  async _resolveUniqueName(userId, dir, baseName, ext) {
    const candidate = `${baseName}${ext}`;
    if (!(await this._pathExists(userId, `${dir}/${candidate}`))) {
      return candidate;
    }

    for (let i = 1; i < 1000; i++) {
      const seqCandidate = `${baseName}_${i}${ext}`;
      if (!(await this._pathExists(userId, `${dir}/${seqCandidate}`))) {
        return seqCandidate;
      }
    }

    // 兜底：序号耗尽（极端情况），回退时间戳
    return `${baseName}_${Date.now().toString(36)}${ext}`;
  }

  /**
   * 检测容器内路径对应的文件是否存在
   * 通过 sh 位置参数 $1 传路径，避免文件名含特殊字符时被 shell 解释。
   *
   * @private
   * @param {number} userId - 用户 ID
   * @param {string} fullPath - 容器内文件完整路径
   * @returns {Promise<boolean>}
   */
  async _pathExists(userId, fullPath) {
    try {
      const out = await this._execCommandOutput(userId, [
        'sh', '-c', 'test -f "$1" && echo yes || echo no', '_', fullPath,
      ]);
      return out.trim() === 'yes';
    } catch {
      // 命令失败时视为不存在，交由后续写入兜底
      return false;
    }
  }

  /**
   * 从完整路径提取文件名
   * @private
   */
  _extractFilename(filePath) {
    return filePath.split('/').pop();
  }

  /**
   * 根据扩展名猜测 MIME 类型
   * @private
   */
  _guessMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeMap = {
      md: 'text/markdown',
      txt: 'text/plain',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      json: 'application/json',
      csv: 'text/csv',
      html: 'text/html',
      xml: 'text/xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg'
    };
    return mimeMap[ext] || 'application/octet-stream';
  }
}

/**
 * 仅用于测试：重置兜底补触发的 in-flight 状态，保证用例间隔离。
 * 生产代码不应调用。
 */
export function _resetRecoveryStateForTests() {
  pendingSummaryKeys.clear();
}

/** 单例导出 */
export const documentService = new DocumentService();
export default documentService;
