/**
 * File Operations Routes
 *
 * Handles all file-related API endpoints with support for both
 * container mode and traditional host mode.
 *
 * Routes:
 * - GET /api/projects/:projectName/file - Read file content
 * - PUT /api/projects/:projectName/file - Save file content
 * - GET /api/projects/:projectName/files - Get project file tree
 * - GET /api/projects/:projectName/files/content - Serve binary files
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
 * Read file content from a project
 */
router.get('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    const userId = req.user.id;

    console.log('[DEBUG] File read request:', projectName, filePath);

    // Security: ensure the requested path is inside the project root
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get file operations based on container mode
    const fileOps = await getFileOperations(userId);

    if (fileOps.isContainer) {
      // Container mode: Read file from container
      try {
        const result = await fileOps.readFile(filePath, {
          projectPath: projectRoot
        });
        res.json({ content: result.content, path: filePath });
      } catch (error) {
        console.error('Error reading file from container:', error);
        res.status(404).json({ error: 'File not found' });
      }
    } else {
      // Host mode: Use traditional file system access
      // Handle both absolute and relative paths
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
 * Save file content to a project
 */
router.put('/:projectName/file', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    const userId = req.user.id;

    console.log('[DEBUG] File save request:', projectName, filePath);

    // Security: ensure the requested path is inside the project root
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get file operations based on container mode
    const fileOps = await getFileOperations(userId);

    if (fileOps.isContainer) {
      // Container mode: Write file to container
      try {
        await fileOps.writeFile(filePath, content, {
          projectPath: projectRoot
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
      // Host mode: Use traditional file system access
      // Handle both absolute and relative paths
      const resolved = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(projectRoot, filePath);
      const normalizedRoot = path.resolve(projectRoot) + path.sep;
      if (!resolved.startsWith(normalizedRoot)) {
        return res.status(403).json({ error: 'Path must be under project root' });
      }

      // Write the new content
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
 * Get project file tree
 */
router.get('/:projectName/files', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[DEBUG] Get files request - userId:', userId, 'projectName:', req.params.projectName);

    // Use extractProjectDirectory to get the actual project path
    let actualPath;
    try {
      actualPath = await extractProjectDirectory(req.params.projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      // Fallback to simple dash replacement
      actualPath = req.params.projectName.replace(/-/g, '/');
    }

    // Get file operations based on container mode
    const fileOps = await getFileOperations(userId);
    console.log('[DEBUG] File operations mode:', fileOps.isContainer ? 'CONTAINER' : 'HOST');

    if (fileOps.isContainer) {
      // Container mode: Get file tree from container
      console.log('[DEBUG] Using container mode for user', userId, 'path:', actualPath);
      const files = await fileOps.getFileTree('.', {
        projectPath: actualPath,
        maxDepth: 10,
        showHidden: true
      });
      console.log('[DEBUG] Container returned', files.length, 'items');
      res.json(files);
    } else {
      // Host mode: Use traditional file system access
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
 * Serve binary file content (for images, etc.)
 */
router.get('/:projectName/files/content', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { path: filePath } = req.query;

    console.log('[DEBUG] Binary file serve request:', projectName, filePath);

    // Security: ensure the requested path is inside the project root
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

    // Check if file exists
    try {
      await fsPromises.access(resolved);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file extension and set appropriate content type
    const mimeType = mime.lookup(resolved) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    // Stream the file
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
