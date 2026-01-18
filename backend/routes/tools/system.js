/**
 * 系统路由
 *
 * 处理系统级别的端点，例如应用程序更新、
 * 健康检查和维护操作。
 *
 * 路由：
 * - POST /api/system/update - 通过 git 更新应用程序
 *
 * @module routes/system
 */

import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { authenticateToken } from '../../middleware/auth.js';
import containerManager from '../../services/container/core/index.js';
import { readStreamOutput } from '../../services/files/utils/file-utils.js';

const router = express.Router();

/**
 * POST /api/system/update
 * 通过运行 git 命令和 npm install 来更新应用程序
 *
 * 此端点执行：git checkout main && git pull && npm install
 * 需要身份验证。
 */
router.post('/update', authenticateToken, async (req, res) => {
    try {
        // 获取项目根目录（server 目录的父目录）
        const projectRoot = path.join(__dirname, '..');

        console.log('Starting system update from directory:', projectRoot);

        // 运行更新命令
        const updateCommand = 'git checkout main && git pull && npm install';

        const child = spawn('sh', ['-c', updateCommand], {
            cwd: projectRoot,
            env: process.env
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log('Update output:', text);
        });

        child.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error('Update error:', text);
        });

        child.on('close', (code) => {
            if (code === 0) {
                res.json({
                    success: true,
                    output: output || 'Update completed successfully',
                    message: 'Update completed. Please restart the server to apply changes.'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Update command failed',
                    output: output,
                    errorOutput: errorOutput
                });
            }
        });

        child.on('error', (error) => {
            console.error('Update process error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        });

    } catch (error) {
        console.error('System update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/system/browse-filesystem
 * 浏览容器内的文件系统，返回目录建议
 * 用于项目创建向导中的路径自动完成
 */
router.get('/browse-filesystem', authenticateToken, async (req, res) => {
  try {
    const { path: inputPath = '~' } = req.query;
    const userId = req.user.userId;

    // 确保容器存在
    await containerManager.getOrCreateContainer(userId);

    // 在容器中执行 ls 命令列出目录内容
    const { stream } = await containerManager.execInContainer(userId, `ls -la "${inputPath}" 2>/dev/null || echo "DIRECTORY_NOT_FOUND"`);

    // 使用 readStreamOutput 辅助函数读取流输出
    const output = await readStreamOutput(stream, { timeout: 5000 });

    // 检查目录是否存在
    if (output.includes('DIRECTORY_NOT_FOUND')) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'Directory not found'
        }
      });
    }

    // 解析 ls 输出
    const lines = output.split('\n');
    const suggestions = [];

    for (const line of lines) {
      // 跳过标题行（total N）和空行
      if (!line.trim() || line.startsWith('total')) {
        continue;
      }

      // ls -la 输出格式：
      // drwxr-xr-x 2 user group 4096 Jan 13 10:00 dirname
      // -rw-r--r-- 1 user group  123 Jan 13 10:00 filename
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        const name = parts.slice(8).join(' ');
        // 跳过 . 和 ..
        if (name !== '.' && name !== '..') {
          const isDir = parts[0].startsWith('d');
          suggestions.push({
            name,
            path: `${inputPath}/${name}`,
            type: isDir ? 'directory' : 'file'
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        suggestions,
        currentPath: inputPath
      }
    });
  } catch (error) {
    console.error('[browse-filesystem] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to browse filesystem'
    });
  }
});

export default router;
