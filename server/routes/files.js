/**
 * 文件操作路由
 *
 * 处理所有与文件相关的 API 端点，支持容器模式和传统主机模式。
 *
 * 路由：
 * - GET /api/projects/:projectName/file - 读取文件内容
 * - PUT /api/projects/:projectName/file - 保存文件内容
 * - GET /api/projects/:projectName/files - 获取项目文件树
 * - GET /api/projects/:projectName/files/content - 提供二进制文件
 */

import express from 'express';
import { promises as fsPromises } from 'fs';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';

import { extractProjectDirectory } from '../services/project/index.js';
import { getFileOperations } from '../config/container-config.js';
import { getFileTree } from '../utils/file-tree.js';

const router = express.Router();

/**
 * GET /api/projects/:projectName/file
 * 从项目读取文件内容
 */
router.get('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    const userId = req.user.userId;

    console.log('[DEBUG] File read request:', projectName, filePath);

    // 安全性：确保请求的路径在项目根目录内
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // 根据容器模式获取文件操作
    const fileOps = await getFileOperations(userId);

    if (fileOps.isContainer) {
      // 容器模式：直接使用 projectName 从容器读取文件
      try {
        const result = await fileOps.readFile(filePath, {
          projectPath: projectName,
          isContainerProject: true
        });
        res.json({ content: result.content, path: filePath });
      } catch (error) {
        console.error('Error reading file from container:', error);
        res.status(404).json({ error: 'File not found' });
      }
    } else {
      // 主机模式：获取实际项目路径
      const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
      if (!projectRoot) {
        return res.status(404).json({ error: 'Project not found' });
      }
      // 主机模式：使用传统文件系统访问
      // 处理绝对路径和相对路径
      const resolved = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(projectRoot, filePath);
      const normalizedRoot = path.resolve(projectRoot) + path.sep;
      if (!resolved.startsWith(normalizedRoot)) {
        return res.status(403).json({ error: 'Path must be under project root' });
      }

      const content = await fsPromises.readFile(resolved, 'utf8');
      res.json({ content, path: resolved });
    }
  } catch (error) {
    console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * PUT /api/projects/:projectName/file
 * 保存文件内容到项目
 */
router.put('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    const userId = req.user.userId;

    console.log('[DEBUG] File save request:', projectName, filePath);

    // 安全性：确保请求的路径在项目根目录内
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // 根据容器模式获取文件操作
    const fileOps = await getFileOperations(userId);

    if (fileOps.isContainer) {
      // 容器模式：直接使用 projectName 向容器写入文件
      try {
        await fileOps.writeFile(filePath, content, {
          projectPath: projectName,
          isContainerProject: true
        });
        res.json({
          success: true,
          path: filePath,
          message: 'File saved successfully'
        });
      } catch (error) {
        console.error('Error writing file to container:', error);
        res.status(500).json({ error: error.message });
      }
    } else {
      // 主机模式：获取实际项目路径
      const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
      if (!projectRoot) {
        return res.status(404).json({ error: 'Project not found' });
      }
      // 主机模式：使用传统文件系统访问
      // 处理绝对路径和相对路径
      const resolved = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(projectRoot, filePath);
      const normalizedRoot = path.resolve(projectRoot) + path.sep;
      if (!resolved.startsWith(normalizedRoot)) {
        return res.status(403).json({ error: 'Path must be under project root' });
      }

      // 写入新内容
      await fsPromises.writeFile(resolved, content, 'utf8');

      res.json({
        success: true,
        path: resolved,
        message: 'File saved successfully'
      });
    }
  } catch (error) {
    console.error('Error saving file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File or directory not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * GET /api/projects/:projectName/files
 * 获取项目文件树
 */
router.get('/:projectName/files', async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectName = req.params.projectName;
    console.log('[DEBUG] Get files request - userId:', userId, 'projectName:', projectName);

    // 根据容器模式获取文件操作
    const fileOps = await getFileOperations(userId);
    console.log('[DEBUG] File operations mode:', fileOps.isContainer ? 'CONTAINER' : 'HOST');

    if (fileOps.isContainer) {
      // 容器模式：按原样使用项目名称（容器中的实际目录名）
      // 项目名称是真实的目录名（例如 "my-workspace"），不是解码后的
      console.log('[DEBUG] Using container mode for user', userId, 'projectName:', projectName);
      const files = await fileOps.getFileTree('.', {
        projectPath: projectName,
        isContainerProject: true,
        maxDepth: 10,
        showHidden: true
      });
      console.log('[DEBUG] Container returned', files.length, 'items');
      res.json(files);
    } else {
      // 主机模式：使用 extractProjectDirectory 获取实际项目路径
      let actualPath;
      try {
        actualPath = await extractProjectDirectory(projectName);
      } catch (error) {
        console.error('Error extracting project directory:', error);
        // 回退到简单的破折号替换
        actualPath = projectName.replace(/-/g, '/');
      }

      // 主机模式：使用传统文件系统访问
      console.log('[DEBUG] Using host mode for path:', actualPath);
      try {
        await fsPromises.access(actualPath);
      } catch (e) {
        return res.status(404).json({ error: `Project path not found: ${actualPath}` });
      }

      const files = await getFileTree(actualPath, 10, 0, true);
      console.log('[DEBUG] Host returned', files.length, 'items');
      res.json(files);
    }
  } catch (error) {
    console.error('[ERROR] File tree error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectName/files/content
 * 提供二进制文件内容（用于图像等）
 */
router.get('/:projectName/files/content', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { path: filePath } = req.query;

    console.log('[DEBUG] Binary file serve request:', projectName, filePath);

    // 安全性：确保请求的路径在项目根目录内
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const resolved = path.resolve(filePath);
    const normalizedRoot = path.resolve(projectRoot) + path.sep;
    if (!resolved.startsWith(normalizedRoot)) {
      return res.status(403).json({ error: 'Path must be under project root' });
    }

    // 检查文件是否存在
    try {
      await fsPromises.access(resolved);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }

    // 获取文件扩展名并设置适当的内容类型
    const mimeType = mime.lookup(resolved) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    // 流式传输文件
    const fileStream = fs.createReadStream(resolved);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

  } catch (error) {
    console.error('Error serving binary file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
