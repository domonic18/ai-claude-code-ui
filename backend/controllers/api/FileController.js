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
import fs from 'fs/promises';
import path from 'path';

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

  /**
   * 提供文件内容（用于图像等二进制文件）
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async serveFileContent(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: filePath } = req.query;
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

      // Detect content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon'
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.send(result.content);
    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 上传文件附件
   * 支持的文件类型：.docx, .pdf, .md, .txt
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async uploadFile(req, res, next) {
    try {
      const userId = this._getUserId(req);

      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const { project } = req.body;
      const projectName = project || 'default';

      // 允许的文件扩展名
      const allowedExtensions = ['.docx', '.pdf', '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.csv'];
      const originalName = req.file.originalname;
      const ext = originalName.toLowerCase().includes('.')
        ? '.' + originalName.split('.').pop().toLowerCase()
        : '';

      if (!allowedExtensions.includes(ext)) {
        throw new ValidationError(`Unsupported file type: ${ext}. Allowed types: ${allowedExtensions.join(', ')}`);
      }

      // 按日期分组存储，保留原始文件名
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 生成安全的文件名（只防止路径遍历，保留中文等字符）
      // 只移除危险的路径字符：.. / \
      let safeBaseName = originalName
        .replace(/\.\./g, '')   // 移除 ..
        .replace(/[\/\\]/g, '_'); // 替换路径分隔符

      // 如果同名文件存在，添加序号后缀
      const userDataDir = path.join(process.cwd(), 'workspace', 'users', `user_${userId}`, 'data');
      const uploadsDir = path.join(userDataDir, projectName, 'uploads', today);

      // 构建完整文件路径
      let finalFilename = safeBaseName;
      let filePath = path.join(uploadsDir, finalFilename);

      // 检查文件是否已存在，如果存在则添加序号
      let counter = 1;
      const nameWithoutExt = safeBaseName.replace(/\.[^.]+$/, '');
      const extension = ext || '';

      // 检查文件是否存在
      try {
        while (await fs.access(filePath)) {
          finalFilename = `${nameWithoutExt}_${counter}${extension}`;
          filePath = path.join(uploadsDir, finalFilename);
          counter++;
        }
      } catch {
        // 文件不存在，可以使用原始文件名
      }

      // 容器内路径：/workspace/{projectName}/uploads/{date}/{filename}
      const containerPath = `/workspace/${projectName}/uploads/${today}/${finalFilename}`;

      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(filePath, req.file.buffer);

      this._success(res, {
        name: originalName,
        path: containerPath,
        size: req.file.size,
        type: req.file.mimetype,
        date: today,
      }, 'File uploaded successfully');
    } catch (error) {
      console.error('[FileController.uploadFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }
}

export default FileController;
