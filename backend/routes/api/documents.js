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
 *
 * @module routes/api/documents
 */

import express from 'express';
import { DocumentController } from '../../controllers/api/index.js';
import { authenticate } from '../../middleware/index.js';
import { createLogger } from '../../utils/logger.js';
import { readmeService } from '../../services/documents/ReadmeService.js';

const logger = createLogger('routes/api/documents');
const router = express.Router();
const documentController = new DocumentController();

/**
 * GET /api/projects/:name/documents
 * 获取项目下所有文档（用户上传 + AI 生成）
 */
router.get('/:name/documents', authenticate(), documentController._asyncHandler(documentController.getDocuments));

/**
 * POST /api/projects/:name/documents/upload
 * 上传文档到项目
 * 使用 multer 处理 multipart/form-data
 */
router.post('/:name/documents/upload', authenticate(), async (req, res, next) => {
  const { name: projectName } = req.params;
  logger.info({ projectName }, '[文档上传] 收到上传请求');

  try {
    const multer = (await import('multer')).default;

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
      },
      fileFilter: (_req, file, cb) => {
        // 允许常见文档类型
        const allowedExts = /\.(md|txt|pdf|doc|docx|xls|xlsx|csv|json|png|jpg|jpeg|gif|svg|webp|html|xml)$/i;
        const ext = '.' + file.originalname.split('.').pop().toLowerCase();
        logger.info({ fileName: file.originalname, ext, mimeType: file.mimetype }, '[文档上传] multer 文件过滤');
        if (allowedExts.test(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported file type: ${ext}`));
        }
      }
    });

    upload.single('file')(req, res, (err) => {
      if (err) {
        logger.warn({ err }, '[文档上传] multer 处理失败');
        return res.status(400).json({ error: err.message });
      }
      logger.info({
        projectName,
        file: req.file ? { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null
      }, '[文档上传] multer 处理完成，交给 controller');
      // multer 处理完后交给 controller
      documentController.uploadDocument(req, res, next);
    });
  } catch (error) {
    logger.error({ err: error }, '[文档上传] 路由层异常');
    next(error);
  }
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
router.put('/:name/documents/summary', authenticate(), async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { name: projectName } = req.params;
    const { file_name: fileName, summary } = req.body;

    if (!fileName || summary === undefined) {
      return res.status(400).json({ error: 'file_name and summary are required' });
    }

    await readmeService.updateSummary(userId, projectName, fileName, summary);
    readmeService.invalidateCache(userId, projectName);

    res.json({ success: true, message: 'Summary updated' });
  } catch (err) {
    logger.error({ err }, '[摘要更新] 路由处理失败');
    res.status(500).json({ error: 'Failed to update summary' });
  }
});

export default router;
