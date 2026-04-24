/**
 * 上传路由
 *
 * 处理文件上传端点，包括音频转录
 * 和图片上传。
 *
 * 路由：
 * - POST /api/transcribe - 将音频转录为文本
 * - POST /api/projects/:projectName/upload-images - 上传图片
 *
 * @module routes/tools/uploads
 */

import express from 'express';
import path from 'path';
import os from 'os';
import { createLogger } from '../../utils/logger.js';
import { handleTranscription } from './transcriptionHandler.js';

const logger = createLogger('routes/tools/uploads');
const router = express.Router();

// 定义 HTTP 路由处理器
/**
 * Process image upload and convert to base64 data URLs
 */
async function processImageUpload(req, res) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No image files provided' });
  }

  const fs = (await import('fs')).promises;

  try {
    // 处理上传的图片
    const processedImages = await Promise.all(
      req.files.map(async (file) => {
        // 读取文件并转换为 base64
        const buffer = await fs.readFile(file.path);
        const base64 = buffer.toString('base64');
        const mimeType = file.mimetype;

        // 立即清理临时文件
        await fs.unlink(file.path);

        return {
          name: file.originalname,
          data: `data:${mimeType};base64,${base64}`,
          size: file.size,
          mimeType: mimeType
        };
      })
    );

    res.json({ images: processedImages });
  } catch (error) {
    logger.error('Error processing images:', error);
    // 清理剩余的文件
    await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {
      logger.debug({ path: f.path }, 'Failed to cleanup uploaded file');
    })));
    res.status(500).json({ error: 'Failed to process images' });
  }
}

/**
 * POST /api/transcribe
 * 使用 OpenAI Whisper API 将音频文件转录为文本
 */
router.post('/transcribe', async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });

    // 处理多部分表单数据
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to process audio file' });
      }

      await handleTranscription(req, res);
    });
  } catch (error) {
    logger.error('Endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/projects/:projectName/upload-images
 * 上传图片文件并将其作为 base64 数据 URL 返回
 */
router.post('/:projectName/upload-images', async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;

    // 为图片上传配置 multer
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'claude-ui-uploads', String(req.user.userId));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
      }
    };

    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
      }
    });

    // 处理多部分表单数据
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      await processImageUpload(req, res);
    });
  } catch (error) {
    logger.error('Error in image upload endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

