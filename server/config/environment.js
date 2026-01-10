/**
 * 环境配置模块
 *
 * 处理环境变量加载、ANSI 颜色定义和容器模式状态记录。
 *
 * @module config/environment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logContainerModeStatus } from './container-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 用于终端输出的 ANSI 颜色代码
 */
export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    dim: '\x1b[2m',
};

/**
 * 彩色控制台输出工具
 */
export const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    ok: (text) => `${colors.green}${text}${colors.reset}`,
    warn: (text) => `${colors.yellow}${text}${colors.reset}`,
    tip: (text) => `${colors.blue}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

/**
 * 从 .env 文件加载环境变量
 * 如果环境变量尚不存在，则设置它们
 */
export function loadEnvironment() {
    try {
        const envPath = path.join(__dirname, '../../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0 && !process.env[key]) {
                    process.env[key] = valueParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        console.log('No .env file found or error reading it:', e.message);
    }

    // 调试日志记录
    console.log('PORT from env:', process.env.PORT);
    console.log('DATABASE_PATH from env:', process.env.DATABASE_PATH);

    // 记录容器模式状态
    logContainerModeStatus();
}
