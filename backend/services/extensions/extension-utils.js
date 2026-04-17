/**
 * Extension 工具函数
 *
 * 提供 extension 相关的共享常量、路径配置和文件操作工具。
 * 供 extension-sync、extension-reader、extension-sdk-loader 共同使用。
 *
 * @module services/extensions/extension-utils
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/extensions/extension-utils');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path configuration
// This file is at: backend/services/extensions/extension-utils.js
// Project root is 4 levels up: extensions -> services -> backend -> project_root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/** 预配置扩展的源目录 */
export const EXTENSIONS_DIR = path.join(PROJECT_ROOT, 'extensions', '.claude');

// ─── 文件类型扩展名映射 ───────────────────────────────

/** 各资源类型允许的文件扩展名 */
export const FILE_EXTENSIONS = {
    agents: ['.json', '.md'],
    commands: ['.md'],
    hooks: ['.js', '.md', '.sh', '.py'],
    knowledge: ['.md', '.txt']
};

// ─── 文件操作工具 ────────────────────────────────────

/**
 * 检查目录是否存在
 * @param {string} dirPath - 目录路径
 * @returns {Promise<boolean>}
 */
export async function directoryExists(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 递归复制目录
 * @param {string} source - 源目录
 * @param {string} target - 目标目录
 */
export async function copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, targetPath);
        } else {
            await fs.copyFile(sourcePath, targetPath);
        }
    }
}

/**
 * 解析 Markdown 内容中的 YAML frontmatter
 * @param {string} content - Markdown 内容
 * @returns {Object} 解析后的 frontmatter 键值对
 */
export function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (!match) return {};

    const frontmatter = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // 处理数组（逗号分隔）
        if (value.includes(',')) {
            value = value.split(',').map(v => v.trim());
        }

        frontmatter[key] = value;
    }

    return frontmatter;
}

/**
 * 从 Markdown 内容提取第一个标题
 * @param {string} content - Markdown 内容
 * @returns {string} 标题文本
 */
export function extractMarkdownTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : '';
}
