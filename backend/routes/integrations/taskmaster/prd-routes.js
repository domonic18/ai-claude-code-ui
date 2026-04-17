/**
 * TaskMaster PRD 文件管理路由
 *
 * 提供 PRD 文件的 CRUD 操作和模板管理 API 端点。
 *
 * 端点列表：
 * - GET    /prd/:projectName            - 列出项目的所有 PRD 文件
 * - POST   /prd/:projectName            - 创建或更新 PRD 文件
 * - GET    /prd/:projectName/:fileName  - 获取特定 PRD 文件内容
 * - DELETE /prd/:projectName/:fileName  - 删除特定 PRD 文件
 * - GET    /prd-templates               - 获取可用的 PRD 模板
 * - POST   /apply-template/:projectName - 应用 PRD 模板创建新文件
 *
 * @module routes/integrations/taskmaster/prd-routes
 */

import express from 'express';
import { createLogger } from '../../../utils/logger.js';
import {
    getAvailableTemplates,
    getTemplateById,
    applyCustomizations,
    listPrdFiles,
    readPrdFile,
    writePrdFile,
    deletePrdFile,
    isValidPrdFileName,
} from '../../../services/projects/taskmaster/index.js';
import { resolveProjectPath } from './task-helpers.js';

const logger = createLogger('routes/integrations/taskmaster/prd-routes');
const router = express.Router();

/**
 * GET /prd/:projectName
 * 列出项目的所有 PRD 文件
 */
router.get('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const prdFiles = await listPrdFiles(projectPath);

        res.json({
            success: true,
            data: {
                projectName,
                projectPath,
                prdFiles,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('PRD list error:', error);
        res.status(500).json({ error: 'Failed to list PRD files', message: error.message });
    }
});

/**
 * POST /prd/:projectName
 * 创建或更新 PRD 文件
 */
router.post('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { fileName, content } = req.body;

        if (!fileName || !content) {
            return res.status(400).json({ error: 'Missing required fields', message: 'fileName and content are required' });
        }

        if (typeof content !== 'string' || content.length > 10_000_000) {
            return res.status(413).json({ error: 'Content too large', message: 'PRD content must not exceed 10 MB' });
        }

        if (!isValidPrdFileName(fileName)) {
            return res.status(400).json({
                error: 'Invalid filename',
                message: 'Filename must end with .txt or .md and contain only alphanumeric characters, spaces, dots, and dashes'
            });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const fileInfo = await writePrdFile(projectPath, fileName, content);

        res.json({
            projectName,
            projectPath,
            ...fileInfo,
            message: 'PRD file saved successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD create/update error:', error);
        res.status(500).json({ error: 'Failed to create/update PRD file', message: error.message });
    }
});

/**
 * GET /prd/:projectName/:fileName
 * 获取特定 PRD 文件的内容
 */
router.get('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;

        if (!isValidPrdFileName(fileName)) {
            return res.status(400).json({ error: 'Invalid filename', message: 'Filename contains disallowed characters' });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const fileInfo = await readPrdFile(projectPath, fileName);

        if (!fileInfo) {
            return res.status(404).json({ error: 'PRD file not found', message: `File "${fileName}" does not exist` });
        }

        res.json({
            projectName,
            projectPath,
            ...fileInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD read error:', error);
        res.status(500).json({ error: 'Failed to read PRD file', message: error.message });
    }
});

/**
 * DELETE /prd/:projectName/:fileName
 * 删除特定的 PRD 文件
 */
router.delete('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;

        if (!isValidPrdFileName(fileName)) {
            return res.status(400).json({ error: 'Invalid filename', message: 'Filename contains disallowed characters' });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const deleted = await deletePrdFile(projectPath, fileName);

        if (!deleted) {
            return res.status(404).json({ error: 'PRD file not found', message: `File "${fileName}" does not exist` });
        }

        res.json({
            projectName,
            projectPath,
            fileName,
            message: 'PRD file deleted successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD delete error:', error);
        res.status(500).json({ error: 'Failed to delete PRD file', message: error.message });
    }
});

/**
 * GET /prd-templates
 * 获取可用的 PRD 模板
 */
router.get('/prd-templates', async (req, res) => {
    try {
        const templates = getAvailableTemplates();
        res.json({ templates, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('PRD templates error:', error);
        res.status(500).json({ error: 'Failed to get PRD templates', message: error.message });
    }
});

/**
 * POST /apply-template/:projectName
 * 应用 PRD 模板以创建新的 PRD 文件
 */
router.post('/apply-template/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { templateId, fileName = 'prd.txt', customizations = {} } = req.body;

        if (!templateId) {
            return res.status(400).json({ error: 'Missing required parameter', message: 'templateId is required' });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const template = getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found', message: `Template "${templateId}" does not exist` });
        }

        const content = applyCustomizations(template.content, customizations);
        const fileInfo = await writePrdFile(projectPath, fileName, content);

        res.json({
            projectName,
            projectPath,
            templateId,
            templateName: template.name,
            ...fileInfo,
            message: 'PRD template applied successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Apply template error:', error);
        res.status(500).json({ error: 'Failed to apply PRD template', message: error.message });
    }
});

export default router;
