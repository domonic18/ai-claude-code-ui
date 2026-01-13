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

export default router;
