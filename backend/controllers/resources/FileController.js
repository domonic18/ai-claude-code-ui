/**
 * FileController.js
 *
 * 文件控制器
 * 处理文件操作相关的请求
 *
 * @module controllers/FileController
 */

import { BaseController } from '../core/BaseController.js';
import { FileOperationsService } from '../../services/files/operations/FileOperationsService.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 文件控制器
 */
export class FileController extends BaseController {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   */
  constructor(dependencies = {}) {
    super(dependencies);
    this.fileOpsService = dependencies.fileOpsService || new FileOperationsService();
  }

  /**
   * 读取文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async readFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.query;
      const { projectName } = req.params;

      if (!filePath) {
        throw new ValidationError('filePath is required');
      }

      const result = await this.fileOpsService.readFile(filePath, {
        userId,
        projectPath: projectName,
        isContainerProject: true,
        containerMode: req.containerMode
      });

      this._success(res, result);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 写入文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async writeFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath, content } = req.body;
      const { projectName } = req.params;

      if (!filePath) {
        throw new ValidationError('filePath is required');
      }

      if (content === undefined) {
        throw new ValidationError('File content is required');
      }

      const result = await this.fileOpsService.writeFile(filePath, content, {
        userId,
        projectPath: projectName,
        isContainerProject: true,
        containerMode: req.containerMode
      });

      this._success(res, result, 'File written successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取文件树
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async getFileTree(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { projectName } = req.params;
      const { depth = 3, showHidden = false } = req.query;

      const tree = await this.fileOpsService.getFileTree('.', {
        userId,
        projectPath: projectName,
        isContainerProject: true,
        containerMode: req.containerMode,
        depth: parseInt(depth, 10),
        includeHidden: showHidden === 'true' || showHidden === true
      });

      this._success(res, tree);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 获取文件统计
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
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

  /**
   * 删除文件
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async deleteFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.params;
      const { recursive = false } = req.body;

      const result = await this.fileOpsService.deleteFile(filePath, {
        userId,
        containerMode: req.containerMode,
        recursive
      });

      this._success(res, result, 'File deleted successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建目录
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async createDirectory(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { dirPath } = req.params;
      const { recursive = true } = req.body;

      const result = await this.fileOpsService.createDirectory(dirPath, {
        userId,
        containerMode: req.containerMode,
        recursive
      });

      this._success(res, result, 'Directory created successfully');
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 检查文件是否存在
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
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
}

export default FileController;
