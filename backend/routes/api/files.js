/**
 * routes/api/files.js
 *
 * 文件 API 路由
 * 使用 FileController 处理文件相关请求
 *
 * @module routes/api/files
 */

import express from 'express';
import { FileController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const fileController = new FileController();

/**
 * GET /api/projects/:projectName/file
 * 从项目读取文件内容
 */
router.get('/:projectName/file', authenticate(), validate({
  query: {
    filePath: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.readFile));

/**
 * PUT /api/projects/:projectName/file
 * 保存文件内容到项目
 */
router.put('/:projectName/file', authenticate(), validate({
  body: {
    filePath: { required: true, type: 'string' },
    content: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.writeFile));

/**
 * GET /api/projects/:projectName/files
 * 获取项目文件树
 */
router.get('/:projectName/files', authenticate(), fileController._asyncHandler(fileController.getFileTree));

/**
 * GET /api/projects/:projectName/files/content
 * 提供二进制文件内容（用于图像等）
 */
router.get('/:projectName/files/content', authenticate(), validate({
  query: {
    path: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.serveFileContent));

/**
 * GET /api/projects/:projectName/files/stats
 * 获取文件统计信息
 */
router.get('/:projectName/files/stats', authenticate(), validate({
  query: {
    path: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.getFileStats));

/**
 * DELETE /api/projects/:projectName/files
 * 删除文件
 */
router.delete('/:projectName/files', authenticate(), validate({
  body: {
    path: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.deleteFile));

/**
 * POST /api/projects/:projectName/directory
 * 创建目录
 */
router.post('/:projectName/directory', authenticate(), validate({
  body: {
    path: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.createDirectory));

/**
 * GET /api/projects/:projectName/files/exists
 * 检查文件是否存在
 */
router.get('/:projectName/files/exists', authenticate(), validate({
  query: {
    path: { required: true, type: 'string' }
  }
}), fileController._asyncHandler(fileController.fileExists));

export default router;
