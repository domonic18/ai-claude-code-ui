/**
 * routes/api/memory.js
 *
 * 记忆 API 路由
 * 使用 MemoryController 处理记忆文件相关请求
 *
 * @module routes/api/memory
 */

import express from 'express';
import { MemoryController } from '../../controllers/api/index.js';
import { authenticate, validate } from '../../middleware/index.js';

const router = express.Router();
const memoryController = new MemoryController();

/**
 * GET /api/memory
 * 读取记忆文件
 */
router.get('/', authenticate(), memoryController._asyncHandler(memoryController.readMemory));

/**
 * PUT /api/memory
 * 保存记忆文件
 */
router.put('/', authenticate(), validate({
  body: {
    content: { required: true, type: 'string' }
  }
}), memoryController._asyncHandler(memoryController.writeMemory));

export default router;
