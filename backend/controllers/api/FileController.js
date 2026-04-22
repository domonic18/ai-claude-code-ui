/**
 * FileController.js
 *
 * File controller
 * Handles file operation requests
 *
 * @module controllers/FileController
 */

import { BaseController } from '../core/BaseController.js';
import { FileOperationsService } from '../../services/files/operations/FileOperationsService.js';
import { ValidationError } from '../../middleware/error-handler.middleware.js';
import { createLogger } from '../../utils/logger.js';
import { getContentType } from './fileOperationHelpers.js';
import { handleFileUpload } from './fileUploadHandler.js';
import { handleFileDownload } from './fileDownloadHandler.js';
import {
  buildFileOperationOptions,
  buildFileTreeOptions,
  validateFilePath
} from './fileOperationBuilders.js';

const logger = createLogger('controllers/api/FileController');

/**
 * File controller
 */
export class FileController extends BaseController {
// 处理业务逻辑，供路由层调用
  /**
   * Constructor
   * @param {Object} dependencies - Dependency injection object
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.fileOpsService = dependencies.fileOpsService || new FileOperationsService();
  }

// 处理业务逻辑，供路由层调用
  /**
   * Reads file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async readFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.query;
      const { projectName } = req.params;

      validateFilePath(filePath);

      const options = buildFileOperationOptions(userId, projectName, req);
      const result = await this.fileOpsService.readFile(filePath, options);

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Writes file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async writeFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath, content } = req.body;
      const { projectName } = req.params;

      validateFilePath(filePath);

      if (content === undefined) {
        throw new ValidationError('File content is required');
      }

      const options = buildFileOperationOptions(userId, projectName, req);
      const result = await this.fileOpsService.writeFile(filePath, content, options);

      this._success(res, result, 'File written successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 获取资源，供路由层调用
  /**
   * Gets file tree
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async getFileTree(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;

      const options = buildFileTreeOptions(userId, projectName, req, req.query);
      const tree = await this.fileOpsService.getFileTree('.', options);

      this._success(res, tree);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 获取资源，供路由层调用
  /**
   * Gets file stats
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async getFileStats(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.params;

      const stats = await this.fileOpsService.getFileStats(filePath, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, stats);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 删除资源，供路由层调用
  /**
   * Deletes file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async deleteFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path } = req.body;
      const { recursive = true } = req.body;

      const result = await this.fileOpsService.deleteFile(path, {
        userId,
        containerMode: req.containerMode,
        recursive
      });

      logger.info('[FileController.deleteFile] User', userId, 'deleted:', path);
      this._success(res, result, 'File deleted successfully');
    } catch (error) {
      logger.error('[FileController.deleteFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Renames file or directory
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async renameFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { oldPath, newName } = req.body;

      const result = await this.fileOpsService.renameFile(oldPath, newName, {
        userId,
        containerMode: req.containerMode
      });

      logger.info('[FileController.renameFile] User', userId, 'renamed:', oldPath, '->', result.newPath);
      this._success(res, result, 'File renamed successfully');
    } catch (error) {
      logger.error('[FileController.renameFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

// 创建新资源，供路由层调用
  /**
   * Creates directory
   * @param {Object} req - Express request object
   * @param {string} req.body.path - Directory path
   * @param {boolean} [req.body.recursive=true] - Recursive create parent directories
   * @param {string} req.params.projectName - Project name
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async createDirectory(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: dirPath, recursive = true } = req.body;
      const { projectName } = req.params;

      validateFilePath(dirPath, 'path');

      const options = buildFileOperationOptions(userId, projectName, req);
      const result = await this.fileOpsService.createDirectory(dirPath, { ...options, recursive });

      this._success(res, result, 'Directory created successfully');
    } catch (error) {
      logger.error('[FileController.createDirectory] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Moves file or directory
   * @param {Object} req - Express request object
   * @param {string} req.body.sourcePath - Source path
   * @param {string} req.body.targetPath - Target directory path (empty string for root)
   * @param {string} req.params.projectName - Project name
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async moveFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sourcePath, targetPath } = req.body;
      const { projectName } = req.params;

      validateFilePath(sourcePath, 'sourcePath');

      if (targetPath === undefined || targetPath === null) {
        throw new ValidationError('targetPath is required');
      }

      const options = buildFileOperationOptions(userId, projectName, req);
      const result = await this.fileOpsService.moveFile(sourcePath, targetPath, options);

      logger.info('[FileController.moveFile] User', userId, 'moved:', sourcePath, '->', result.newPath);
      this._success(res, result, 'File moved successfully');
    } catch (error) {
      logger.error('[FileController.moveFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Checks if file exists
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async fileExists(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.params;

      const exists = await this.fileOpsService.fileExists(filePath, {
        userId,
        containerMode: req.containerMode
      });

      this._success(res, { exists });
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Serves file content (for images and other binary files)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async serveFileContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: filePath } = req.query;
      const { projectName } = req.params;

      validateFilePath(filePath);

      const options = buildFileOperationOptions(userId, projectName, req);
      const result = await this.fileOpsService.readFile(filePath, options);

      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentType = getContentType(ext);

      res.setHeader('Content-Type', contentType);
      res.send(result.content);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Uploads file attachment
   * Supported types: .docx, .pdf, .md, .txt
   * Uses Docker putArchive API to write file directly to user volume
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async uploadFile(req, res, next) {
    try {
      const userId = this._getUserId(req);

      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const { project } = req.body;
      const projectName = project || 'default';

      const responseData = await handleFileUpload(req.file, userId, projectName);

      this._success(res, responseData, 'File uploaded successfully');
    } catch (error) {
      logger.error('[FileController.uploadFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

// 处理业务逻辑，供路由层调用
  /**
   * Downloads file (for binary files like docx, pdf, etc.)
   * Reads file from container and returns as binary stream
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware
   */
  async downloadFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.query;
      const { projectName } = req.params;

      validateFilePath(filePath);

      const { content, contentType, fileName } = await handleFileDownload(userId, filePath, projectName);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', content.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.attachment(fileName);
      res.send(content);

    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }
}

export default FileController;

