/**
 * routes/api/documents.js
 *
 * 文档管理 API 路由
 * 处理项目文档的列表、上传、删除、预览
 *
 * 路由：
 * - GET    /api/projects/:name/documents        - 获取项目下所有文档
 * - POST   /api/projects/:name/documents/upload - 上传文档
 * - DELETE /api/projects/:name/documents         - 删除文档
 * - PUT    /api/projects/:name/documents/content - 保存文档内容（编辑）
 * - GET    /api/projects/:name/documents/content - 获取文档内容（预览）
 * - PUT    /api/projects/:name/documents/summary - 更新文档摘要
 *
 * @module routes/api/documents
 */

import express from 'express';
import multer from 'multer';
import { DocumentController } from '../../controllers/api/index.js';
import { authenticate } from '../../middleware/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/api/documents');
const router = express.Router();
const documentController = new DocumentController();

/**
 * multer 实例（模块级单例，避免每次请求重新创建）
 * 使用 memoryStorage，文件保存在 req.file.buffer
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // 扩展名白名单
    const allowedExts = /\.(md|txt|pdf|doc|docx|xls|xlsx|csv|json|png|jpg|jpeg|gif|svg|webp|html|xml)$/i;
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();

    // MIME 类型白名单（扩展名校验 + MIME 校验双重防线）
    const allowedMimes = [
      'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp',
    ];

    logger.info({ fileName: file.originalname, ext, mimeType: file.mimetype }, '[文档上传] multer 文件过滤');

    if (!allowedExts.test(ext)) {
      return cb(new Error(`Unsupported file type: ${ext}`));
    }

    if (!allowedMimes.includes(file.mimetype)) {
      logger.warn({ fileName: file.originalname, ext, mimeType: file.mimetype }, '[文档上传] MIME 类型不在白名单');
      return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
    }

    cb(null, true);
  },
});

/**
 * GET /api/projects/:name/documents
 * 获取项目下所有文档（用户上传 + AI 生成）
 */
router.get('/:name/documents', authenticate(), documentController._asyncHandler(documentController.getDocuments));

/**
 * POST /api/projects/:name/documents/upload
 * 上传文档到项目
 */
router.post('/:name/documents/upload', authenticate(), upload.single('file'), (req, res, next) => {
  if (!req.file) {
    logger.warn('[文档上传] multer 未解析出文件');
    return res.status(400).json({ error: 'No file uploaded or unsupported file type' });
  }
  logger.info({
    file: { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype },
  }, '[文档上传] multer 处理完成，交给 controller');
  documentController.uploadDocument(req, res, next);
});

/**
 * DELETE /api/projects/:name/documents
 * 删除文档
 * Body: { file_path: string, doc_type: 'upload' | 'ai_generated' }
 */
router.delete('/:name/documents', authenticate(), documentController._asyncHandler(documentController.deleteDocument));

/**
 * PUT /api/projects/:name/documents/content
 * 保存文档内容（编辑后保存）
 * Body: { file_path: string, content: string }
 */
router.put('/:name/documents/content', authenticate(), documentController._asyncHandler(documentController.saveDocumentContent));

/**
 * GET /api/projects/:name/documents/content?file_path=xxx
 * 获取文档内容（用于预览）
 */
router.get('/:name/documents/content', authenticate(), documentController._asyncHandler(documentController.getDocumentContent));

/**
 * PUT /api/projects/:name/documents/summary
 * 更新文档摘要
 * Body: { file_name: string, summary: string }
 */
router.put('/:name/documents/summary', authenticate(), documentController._asyncHandler(documentController.updateSummary));

export default router;
