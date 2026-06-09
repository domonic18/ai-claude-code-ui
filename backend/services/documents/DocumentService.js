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
import path from 'path';
import { summaryService } from './SummaryService.js';
import { readmeService } from './ReadmeService.js';
import { validateContainerPath, validateProjectFilePath, validateProjectName } from '../../utils/pathValidator.js';
import { writeFileViaPutArchive } from '../container/utils/containerFileWriter.js';

const logger = createLogger('services/documents/DocumentService');

/** 文档目录在容器内的相对路径 */
const DOCUMENTS_DIR = 'documents';
const UPLOADS_SUBDIR = 'uploads';
const AI_MANIFEST_FILE = '.ai-documents.json';

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
    const [uploads, aiManifest, generatedFiles, readmeEntries] = await Promise.all([
      this._scanUploads(userId, projectName),
      this._readAIManifest(userId, projectName),
      this._scanGeneratedDir(userId, projectName),
      readmeService.parseEntries(userId, projectName),
    ]);

    // 合并去重：manifest 记录 + 目录扫描结果（以 file_path 为唯一键）
    const aiGenerated = this._mergeDocuments(aiManifest, generatedFiles);

    // 为 uploads 附加摘要状态和内容
    const enrichedUploads = uploads.map(upload => {
      const entry = readmeEntries.find(e => e.fileName === upload.file_name);
      return {
        ...upload,
        summary_status: entry ? 'ready' : 'pending',
        summary: entry?.summary || null,
      };
    });

    // 为 AI 生成文档也附加摘要状态
    const enrichedAiGenerated = aiGenerated.map(doc => {
      const entry = readmeEntries.find(e => e.fileName === doc.file_name);
      return {
        ...doc,
        summary_status: entry ? 'ready' : 'pending',
        summary: entry?.summary || null,
      };
    });

    logger.info({
      projectName,
      readmeEntries: readmeEntries.map(e => e.fileName),
      uploads: enrichedUploads.map(u => ({ name: u.file_name, status: u.summary_status })),
      aiGenerated: enrichedAiGenerated.map(d => ({ name: d.file_name, status: d.summary_status })),
    }, '[getProjectDocuments] 文档摘要状态');

    return { uploads: enrichedUploads, aiGenerated: enrichedAiGenerated };
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
    // 生成安全的文件名
    const safeName = this._sanitizeFilename(fixedName);
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

    logger.info({ userId, projectName, filePath, docType }, '文档删除成功');
    return true;
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
    const dir = `/workspace/${projectName}/generated_docs`;
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
      // 纵深防御：service 层再次校验 projectName，防止绕过 controller 校验
      const nameCheck = validateProjectName(projectName);
      if (!nameCheck.valid) {
        logger.warn({ userId, projectName, err: nameCheck.error }, '[scanDirectory] projectName 校验失败');
        return [];
      }

      await containerManager.getOrCreateContainer(userId);
      const fileListOutput = await this._execCommandOutput(userId, [
        'sh', '-c',
        `find "${directory}" -type f 2>/dev/null | head -${maxFiles}`,
      ]);

      if (!fileListOutput || !fileListOutput.trim()) {
        return [];
      }

      const filePaths = fileListOutput.trim().split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const results = [];
      for (const filePath of filePaths) {
        try {
          const [sizeOutput, mtimeOutput] = await Promise.all([
            this._execCommandOutput(userId, [
              'sh', '-c', `wc -c < "${filePath}" 2>/dev/null | tr -d ' '`,
            ]),
            this._execCommandOutput(userId, [
              'sh', '-c', `stat -c '%Y' "${filePath}" 2>/dev/null || echo '0'`,
            ]),
          ]);
          const fileName = filePath.split('/').pop();
          results.push({
            file_name: fileName,
            file_path: filePath,
            file_size: parseInt(sizeOutput.trim(), 10) || 0,
            type: docType,
            created_at: new Date(parseInt(mtimeOutput.trim(), 10) * 1000).toISOString(),
          });
        } catch {
          // 跳过无法读取的文件
        }
      }
      return results;
    } catch (error) {
      logger.debug({ userId, projectName, directory, err: error }, `${docType} 目录扫描跳过`);
      return [];
    }
  }

  /**
   * 读取 AI 文档清单
   * @private
   * @returns {Promise<Array>}
   */
  async _readAIManifest(userId, projectName) {
    const manifestPath = `/workspace/${projectName}/${DOCUMENTS_DIR}/${AI_MANIFEST_FILE}`;

    try {
      await containerManager.getOrCreateContainer(userId);
      const content = await this._readFileFromContainer(userId, manifestPath);
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * 写入 AI 文档清单
   * @private
   */
  async _writeAIManifest(userId, projectName, manifest) {
    const dirPath = `/workspace/${projectName}/${DOCUMENTS_DIR}`;
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

    await writeFileViaPutArchive(dockerContainer, containerFilePath, buffer.toString('utf-8'), {
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
   * 清理文件名，防止路径注入
   * 保留中文及常见 CJK 字符，截断超长文件名
   * @private
   */
  _sanitizeFilename(originalName) {
    // 允许：字母、数字、点、下划线、连字符、CJK 统一汉字、CJK 符号、全角字符
    const name = originalName.replace(/[^\w.\-一-鿿㐀-䶿　-〿＀-￯]/g, '_');

    const uniqueId = Date.now().toString(36);
    const dotIndex = name.lastIndexOf('.');
    const MAX_BASENAME = 60; // 基础文件名最大长度，避免 tar 路径超限

    if (dotIndex > 0) {
      const ext = name.slice(dotIndex); // 含点，如 .docx
      let baseName = name.slice(0, dotIndex);
      if (baseName.length > MAX_BASENAME) {
        baseName = baseName.slice(0, MAX_BASENAME);
      }
      return `${baseName}_${uniqueId}${ext}`;
    }
    let baseName = name;
    if (baseName.length > MAX_BASENAME) {
      baseName = baseName.slice(0, MAX_BASENAME);
    }
    return `${baseName}_${uniqueId}`;
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

/** 单例导出 */
export const documentService = new DocumentService();
export default documentService;
