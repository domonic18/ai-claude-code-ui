/**
 * TaskMaster 路由聚合器
 *
 * 将 TaskMaster 的三个功能域子路由合并为一个统一路由：
 * - task-routes：安装检测、配置检测、任务列表、推荐任务
 * - prd-routes：PRD 文件 CRUD、模板管理
 * - cli-routes：初始化、任务增删改、PRD 解析
 *
 * @module routes/integrations/taskmaster
 */

import express from 'express';
import taskRoutes from './task-routes.js';
import prdRoutes from './prd-routes.js';
import cliRoutes from './cli-routes.js';

const router = express.Router();

// 挂载子路由（路径前缀为空，所有端点在同一层级）
router.use(taskRoutes);
router.use(prdRoutes);
router.use(cliRoutes);

export default router;
