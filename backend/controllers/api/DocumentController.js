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
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('controllers/api/DocumentController');

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

  /**
   * 获取项目下所有文档
   * GET /api/projects/:name/documents
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   */
  async getDocuments(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { name: projectName } = req.params;

      if (!projectName) {
        throw new ValidationError('Project name is required');
      }

      const documents = await documentService.getProjectDocuments(userId, projectName);

      this._success(res, documents);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 上传文档到项目
   * POST /api/projects/:name/documents/upload
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   */
  async uploadDocument(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { name: projectName } = req.params;

      logger.info({ userId, projectName, hasFile: !!req.file }, '[文档上传] Controller 收到请求');

      if (!projectName) {
        throw new ValidationError('Project name is required');
      }

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

      const result = await documentService.uploadDocument(userId, projectName, req.file);

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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   */
  async deleteDocument(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { name: projectName } = req.params;
      const { file_path: filePath, doc_type: docType } = req.body;

      if (!projectName || !filePath) {
        throw new ValidationError('Project name and file path are required');
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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   */
  async saveDocumentContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { file_path: filePath, content } = req.body;

      if (!filePath || content === undefined) {
        throw new ValidationError('file_path and content are required');
      }

      if (!filePath.startsWith('/workspace/')) {
        throw new ValidationError('Invalid file path');
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
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   */
  async getDocumentContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { file_path: filePath } = req.query;

      if (!filePath) {
        throw new ValidationError('file_path query parameter is required');
      }

      // 安全校验：确保路径在 /workspace 下
      if (!filePath.startsWith('/workspace/')) {
        throw new ValidationError('Invalid file path');
      }

      const result = await documentService.getDocumentContent(userId, filePath);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default DocumentController;
