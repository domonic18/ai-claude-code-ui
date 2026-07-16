/**
 * DocumentController.js
 *
 * 文档管理控制器
 * 处理项目文档的列表、上传、删除、预览请求
 *
 * @module controllers/api/DocumentController
 */

import { BaseController } from '../core/BaseController.js';
import { documentService } from '../../services/documents/DocumentService.js';
import { readmeService } from '../../services/documents/ReadmeService.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';
import { createLogger } from '../../utils/logger.js';
import { validateContainerPath, validateProjectFilePath, validateProjectName } from '../../utils/pathValidator.js';

const logger = createLogger('controllers/api/DocumentController');

/** 内容大小上限（50MB，与上传限制一致） */
const MAX_CONTENT_SIZE = 50 * 1024 * 1024;

/**
 * 文档控制器
 */
export class DocumentController extends BaseController {
  /**
   * 构造函数
   */
  constructor() {
    super();
  }

  // ─── 公共辅助方法 ─────────────────────────────────────

  /**
   * 从请求中提取并校验 projectName
   * @param {Object} req - Express 请求对象
   * @returns {string} 校验通过的 projectName
   * @throws {ValidationError} projectName 缺失或不合法
   * @protected
   */
  _requireProjectName(req) {
    const { name: projectName } = req.params;
    if (!projectName) {
      throw new ValidationError('Project name is required');
    }
    const nameCheck = validateProjectName(projectName);
    if (!nameCheck.valid) {
      throw new ValidationError(nameCheck.error);
    }
    return projectName;
  }

  // ─── 路由处理方法 ─────────────────────────────────────

  /**
   * 获取项目下所有文档
   * GET /api/projects/:name/documents
   */
  async getDocuments(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);

      const documents = await documentService.getProjectDocuments(userId, projectName);

      this._success(res, documents);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 上传文档到项目
   * POST /api/projects/:name/documents/upload
   */
  async uploadDocument(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);

      logger.info({ userId, projectName, hasFile: !!req.file }, '[文档上传] Controller 收到请求');

      if (!req.file) {
        logger.warn({ userId, projectName }, '[文档上传] req.file 为空，multer 可能未正确解析');
        throw new ValidationError('No file uploaded');
      }

      logger.info({
        userId,
        projectName,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }, '[文档上传] 开始调用 DocumentService.uploadDocument');

      const result = await documentService.uploadDocument(userId, projectName, req.file, req.body?.model);

      logger.info({ userId, projectName, result }, '[文档上传] DocumentService 上传成功，返回响应');
      this._success(res, result, 'Document uploaded successfully', 201);
    } catch (error) {
      logger.error({ err: error }, '[文档上传] Controller 处理失败');
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 删除文档
   * DELETE /api/projects/:name/documents
   */
  async deleteDocument(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);
      const { file_path: filePath, doc_type: docType } = req.body;

      if (!filePath) {
        throw new ValidationError('file_path is required');
      }

      const pathCheck = validateProjectFilePath(filePath, projectName);
      if (!pathCheck.valid) {
        throw new ValidationError(pathCheck.error);
      }

      await documentService.deleteDocument(userId, projectName, filePath, docType);

      this._success(res, null, 'Document deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 保存文档内容
   * PUT /api/projects/:name/documents/content
   */
  async saveDocumentContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);
      const { file_path: filePath, content } = req.body;

      if (!filePath || content === undefined) {
        throw new ValidationError('file_path and content are required');
      }

      if (typeof content === 'string' && content.length > MAX_CONTENT_SIZE) {
        throw new ValidationError(`Content exceeds maximum size limit (${MAX_CONTENT_SIZE / 1024 / 1024}MB)`);
      }

      const pathCheck = validateProjectFilePath(filePath, projectName);
      if (!pathCheck.valid) {
        throw new ValidationError(pathCheck.error);
      }

      await documentService.saveDocumentContent(userId, filePath, content);

      this._success(res, null, 'Document saved successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取文档内容（用于预览）
   * GET /api/projects/:name/documents/content
   */
  async getDocumentContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);
      const { file_path: filePath } = req.query;

      if (!filePath) {
        throw new ValidationError('file_path query parameter is required');
      }

      const pathCheck = validateProjectFilePath(filePath, projectName);
      if (!pathCheck.valid) {
        throw new ValidationError(pathCheck.error);
      }

      const result = await documentService.getDocumentContent(userId, filePath);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 更新文档摘要
   * PUT /api/projects/:name/documents/summary
   */
  async updateSummary(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);
      const { file_name: fileName, summary } = req.body;

      if (!fileName || summary === undefined) {
        throw new ValidationError('file_name and summary are required');
      }

      await readmeService.updateSummary(userId, projectName, fileName, summary);
      readmeService.invalidateCache(userId, projectName);
      // 同步失效文档列表缓存：getProjectDocuments 的 5s 缓存会派生 summary_status，
      // 不清则前端 refetch 拿到旧 error 数据，手动填写后仍显示红色（Bug 1）。
      documentService.invalidateDocumentsCache(userId, projectName);

      this._success(res, null, 'Summary updated');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重新生成文档摘要（重调 AI）
   * POST /api/projects/:name/documents/summary/regenerate
   * Body: { file_path: string, file_name: string, source?: 'upload'|'ai' }
   */
  async regenerateSummary(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const projectName = this._requireProjectName(req);
      const { file_path: filePath, file_name: fileName, source, model } = req.body;

      if (!filePath || !fileName) {
        throw new ValidationError('file_path and file_name are required');
      }

      const pathCheck = validateProjectFilePath(filePath, projectName);
      if (!pathCheck.valid) {
        throw new ValidationError(pathCheck.error);
      }

      const result = await documentService.regenerateSummary(userId, projectName, filePath, fileName, source, model);

      this._success(res, result, 'Summary regeneration started');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default DocumentController;
