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
import containerManager from '../../services/container/core/index.js';
import { ALLOWED_UPLOAD_EXTENSIONS } from '../../services/files/constants.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import tar from 'tar';

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
      const { path } = req.body;
      const { recursive = true } = req.body;

      const result = await this.fileOpsService.deleteFile(path, {
        userId,
        containerMode: req.containerMode,
        recursive
      });

      console.log('[FileController.deleteFile] User', userId, 'deleted:', path);
      this._success(res, result, 'File deleted successfully');
    } catch (error) {
      console.error('[FileController.deleteFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 重命名文件或目录
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async renameFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { oldPath, newName } = req.body;

      const result = await this.fileOpsService.renameFile(oldPath, newName, {
        userId,
        containerMode: req.containerMode
      });

      console.log('[FileController.renameFile] User', userId, 'renamed:', oldPath, '->', result.newPath);
      this._success(res, result, 'File renamed successfully');
    } catch (error) {
      console.error('[FileController.renameFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 创建目录
   * @param {Object} req - Express 请求对象
   * @param {string} req.body.path - 目录路径
   * @param {boolean} [req.body.recursive=true] - 是否递归创建父目录
   * @param {string} req.params.projectName - 项目名称
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async createDirectory(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { path: dirPath } = req.body;
      const { recursive = true } = req.body;
      const { projectName } = req.params;

      if (!dirPath) {
        throw new ValidationError('path is required');
      }

      const result = await this.fileOpsService.createDirectory(dirPath, {
        userId,
        projectPath: projectName,
        isContainerProject: true,
        containerMode: req.containerMode,
        recursive
      });

      this._success(res, result, 'Directory created successfully');
    } catch (error) {
      console.error('[FileController.createDirectory] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 移动文件或目录
   * @param {Object} req - Express 请求对象
   * @param {string} req.body.sourcePath - 源路径
   * @param {string} req.body.targetPath - 目标目录路径（空字符串表示根目录）
   * @param {string} req.params.projectName - 项目名称
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async moveFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { sourcePath, targetPath } = req.body;
      const { projectName } = req.params;

      if (!sourcePath) {
        throw new ValidationError('sourcePath is required');
      }

      if (targetPath === undefined || targetPath === null) {
        throw new ValidationError('targetPath is required');
      }

      const result = await this.fileOpsService.moveFile(sourcePath, targetPath, {
        userId,
        projectPath: projectName,
        isContainerProject: true,
        containerMode: req.containerMode
      });

      console.log('[FileController.moveFile] User', userId, 'moved:', sourcePath, '->', result.newPath);
      this._success(res, result, 'File moved successfully');
    } catch (error) {
      console.error('[FileController.moveFile] Error:', error);
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
   * 使用 Docker putArchive API 将文件直接写入用户命名卷
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

      const originalName = req.file.originalname;
      const ext = originalName.toLowerCase().includes('.')
        ? '.' + originalName.split('.').pop().toLowerCase()
        : '';

      if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
        throw new ValidationError(`Unsupported file type: ${ext}. Allowed types: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`);
      }

      // 按日期分组存储
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 生成 ASCII 安全的文件名（避免中文文件名编码问题）
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
      const safeFilename = `${uniqueId}${ext}`;

      // 容器内路径：/workspace/{projectName}/uploads/{date}/{filename}
      const containerPath = `/workspace/${projectName}/uploads/${today}/${safeFilename}`;
      const containerDir = `/workspace/${projectName}/uploads/${today}`;

      // 获取用户命名卷名称
      const volumeName = `claude-user-${userId}-workspace`;

      // 使用 putArchive API 将文件写入用户命名卷
      const container = await containerManager.getOrCreateContainer(userId);
      const dockerContainer = containerManager.docker.getContainer(container.id);

      // 创建本地临时文件和 tar（保持完整目录结构）
      const tempDir = `/tmp/upload_${Date.now()}`;
      const localDirPath = `${tempDir}/${projectName}/uploads/${today}`;
      const localFilePath = `${localDirPath}/${safeFilename}`;

      await fs.mkdir(localDirPath, { recursive: true });
      await fs.writeFile(localFilePath, req.file.buffer);

      // 创建 tar 归档（保持目录结构，使用 ustar 格式避免扩展属性）
      const tarPath = `${tempDir}/archive.tar`;
      execSync(
        `tar --format=ustar -cf "${tarPath}" -C "${tempDir}" "${projectName}/uploads/${today}/${safeFilename}"`,
        { cwd: tempDir }
      );

      // 读取 tar 文件
      const tarBuffer = await fs.readFile(tarPath);

      // 使用 putArchive 上传到容器（上传到 /workspace 下，会自动解压）
      await new Promise((resolve, reject) => {
        dockerContainer.putArchive(tarBuffer, { path: '/workspace' }, (err) => {
          if (err) {
            reject(new Error(`putArchive failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });

      // 清理临时文件
      await fs.rm(tempDir, { recursive: true, force: true });

      const responseData = {
        displayName: originalName,     // 原始文件名，用于显示
        filename: safeFilename,        // 实际文件名（ASCII 安全）
        path: containerPath,           // 容器内完整路径
        size: req.file.size,
        type: req.file.mimetype,
        date: today,
      };

      console.log('[FileController.uploadFile] User', userId, 'uploaded:', originalName, '->', containerPath);
      this._success(res, responseData, 'File uploaded successfully');
    } catch (error) {
      console.error('[FileController.uploadFile] Error:', error);
      this._handleError(error, req, res, next);
    }
  }

  /**
   * 下载文件（用于二进制文件如 docx, pdf 等）
   * 从容器中读取文件并以二进制流方式返回
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @param {Function} next - 下一个中间件
   */
  async downloadFile(req, res, next) {
    try {
      const userId = this._getUserId(req);
      const { filePath } = req.query;
      const { projectName } = req.params;

      if (!filePath) {
        throw new ValidationError('filePath is required');
      }

      // 使用 Docker getArchive API 从容器中提取文件
      const container = await containerManager.getOrCreateContainer(userId);
      const dockerContainer = containerManager.docker.getContainer(container.id);

      // 文件在容器内的路径
      const containerPath = filePath.startsWith('/') ? filePath : `/workspace/${projectName}/${filePath}`;

      // 获取文件名（用于下载）
      const fileName = path.basename(containerPath);

      // 检测文件扩展名以设置 Content-Type
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const contentTypes = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        zip: 'application/zip',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        webp: 'image/webapp',
        ico: 'image/x-icon',
        mp3: 'audio/mpeg',
        mp4: 'video/mp4',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';

      // 使用 Docker getArchive API 获取 tar 流
      const tarStream = await new Promise((resolve, reject) => {
        dockerContainer.getArchive({ path: containerPath }, (err, stream) => {
          if (err) {
            reject(new Error(`getArchive failed: ${err.message}`));
            return;
          }
          resolve(stream);
        });
      });

      // 使用 tar 模块解析并在内存中提取文件
      const entries = [];
      await new Promise((resolve, reject) => {
        const parser = new tar.Parse();

        parser.on('entry', (entry) => {
          const chunks = [];
          entry.on('data', (chunk) => chunks.push(chunk));
          entry.on('end', () => {
            entries.push({
              path: entry.path,
              data: Buffer.concat(chunks)
            });
          });
          entry.resume();
        });

        parser.on('end', resolve);
        parser.on('error', reject);

        tarStream.pipe(parser);
      });

      // 找到目标文件
      const targetEntry = entries.find(e => e.path.endsWith(fileName) || path.basename(e.path) === fileName);
      if (!targetEntry) {
        console.error('[FileController.downloadFile] File not found in archive. Available entries:', entries.map(e => e.path));
        throw new Error('File not found in archive');
      }

      const fileContent = targetEntry.data;

      console.log('[FileController.downloadFile] User', userId, 'downloaded:', containerPath, 'size:', fileContent.length, 'entry:', targetEntry.path);

      // 设置响应头并发送文件
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileContent.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.attachment(fileName);

      // 发送文件内容
      res.send(fileContent);

    } catch (error) {
      this._handleError(error, req, res, next);
    }
  }

}

export default FileController;
