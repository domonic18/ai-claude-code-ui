/**
 * Extension 元数据读取器
 *
 * 从 extensions/.claude/ 目录读取各类型扩展的元数据，
 * 用于管理界面展示可用的 agents、commands、skills、hooks 和 knowledge。
 *
 * @module services/extensions/extension-reader
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
    EXTENSIONS_DIR,
    FILE_EXTENSIONS,
    directoryExists,
    fileExists,
    extractMarkdownTitle
} from './extension-utils.js';

const logger = createLogger('services/extensions/extension-reader');

// ─── 各类型描述提取器 ─────────────────────────────────

/**
 * 从 .js 文件提取 JSDoc 描述
 * @param {string} content - 文件内容
 * @returns {string}
 */
function extractJsDescription(content) {
    const match = content.match(/\/\*\*\s*([^*]|\*(?!\/))*\*\//);
    return match ? match[0].substring(2, match[0].length - 2).trim().substring(0, 100) : 'JavaScript Hook';
}

/**
 * 从 .sh 文件提取首行注释描述
 * @param {string} content - 文件内容
 * @returns {string}
 */
function extractShDescription(content) {
    const match = content.match(/^#\s*(.+)$/m);
    return match ? match[1] : 'Shell Script Hook';
}

/**
 * 从 .py 文件提取 docstring 或注释描述
 * @param {string} content - 文件内容
 * @returns {string}
 */
function extractPyDescription(content) {
    const docstringMatch = content.match(/"""[\s\S]*?"""/);
    if (docstringMatch) {
        return docstringMatch[0].replace(/"/g, '').trim().substring(0, 100);
    }
    const commentMatch = content.match(/^#\s*(.+)$/m);
    return commentMatch ? commentMatch[1] : 'Python Script Hook';
}

/**
 * 根据文件扩展名提取描述
 * @param {string} ext - 文件扩展名（含点）
 * @param {string} content - 文件内容
 * @returns {string}
 */
function extractDescription(ext, content) {
    try {
        switch (ext) {
            case '.js': return extractJsDescription(content);
            case '.md': return extractMarkdownTitle(content);
            case '.sh': return extractShDescription(content);
            case '.py': return extractPyDescription(content);
            default: return content.substring(0, 100).trim();
        }
    } catch {
        const defaults = { '.js': 'JavaScript Hook', '.md': 'Markdown Hook', '.sh': 'Shell Script Hook', '.py': 'Python Script Hook' };
        return defaults[ext] || 'Unknown';
    }
}

// ─── 泛型目录读取器 ───────────────────────────────────

/**
 * 通用目录读取器——消除 readAgents/readCommands/readSkills/readHooks/readKnowledge 的重复结构
 * @param {string} subDir - 相对于 EXTENSIONS_DIR 的子目录名
 * @param {Object} options
 * @param {Function} [options.filter] - 筛选目录项 (entry) => boolean
 * @param {Function} [options.parseEntry] - 从目录项解析元数据 (entry, fullPath) => Promise<object>
 * @returns {Promise<Array>}
 */
async function readExtensionDir(subDir, { filter = () => true, parseEntry } = {}) {
    const results = [];
    const dirPath = path.join(EXTENSIONS_DIR, subDir);
    if (!(await directoryExists(dirPath))) return results;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!filter(entry)) continue;
        if (parseEntry) {
            try {
                const item = await parseEntry(entry, path.join(dirPath, entry.name));
                if (item) results.push(item);
            } catch {
                results.push({ filename: entry.name, name: entry.name, description: '[解析失败]' });
            }
        }
    }
    return results;
}

// ─── 各类型读取函数（使用泛型读取器）────────────────────

async function readAgents() {
    return readExtensionDir('agents', {
        filter: (entry) => entry.isFile() && entry.name.endsWith('.json'),
        parseEntry: async (entry, filePath) => {
            try {
                const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
                return { filename: entry.name, name: content.name || entry.name.replace('.json', ''), description: content.description || '' };
            } catch {
                return { filename: entry.name, name: entry.name.replace('.json', ''), description: '[解析失败]' };
            }
        }
    });
}

async function readCommands() {
    return readExtensionDir('commands', {
        filter: (entry) => entry.isFile() && entry.name.endsWith('.md'),
        parseEntry: async (entry) => ({ filename: entry.name, name: entry.name.replace('.md', '') })
    });
}

async function readSkills() {
    return readExtensionDir('skills', {
        filter: (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
        parseEntry: async (entry, filePath) => {
            let description = '';
            const skillMdPath = path.join(filePath, 'SKILL.md');
            if (await fileExists(skillMdPath)) {
                try { description = extractMarkdownTitle(await fs.readFile(skillMdPath, 'utf-8')); } catch { description = '[无法读取]'; }
            }
            return { name: entry.name, description };
        }
    });
}

async function readHooks() {
    const allowedExts = FILE_EXTENSIONS.hooks;
    return readExtensionDir('hooks', {
        filter: (entry) => entry.isFile() && allowedExts.includes(path.extname(entry.name)),
        parseEntry: async (entry, filePath) => {
            let description = '';
            try { description = extractDescription(path.extname(entry.name), await fs.readFile(filePath, 'utf-8')); } catch { description = extractDescription(path.extname(entry.name), ''); }
            return { filename: entry.name, name: entry.name.replace(/\.(js|md|sh|py)$/, ''), type: path.extname(entry.name).substring(1), description };
        }
    });
}

async function readKnowledge() {
    const allowedExts = FILE_EXTENSIONS.knowledge;
    return readExtensionDir('knowledge', {
        filter: () => true,
        parseEntry: async (entry, filePath) => {
            if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (!allowedExts.includes(ext)) return null;
                let description = '';
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    description = ext === '.md' ? (extractMarkdownTitle(content) || content.substring(0, 100).trim()) : content.substring(0, 100).trim();
                } catch { description = 'Knowledge File'; }
                return { filename: entry.name, name: entry.name.replace(/\.(md|txt)$/, ''), type: ext.substring(1), description };
            }
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                return { filename: entry.name + '/', name: entry.name, type: 'dir', description: 'Knowledge Directory' };
            }
            return null;
        }
    });
}

// ─── 公共 API ─────────────────────────────────────────

/** 扩展元数据缓存（避免每次请求都从磁盘读取全部文件） */
let extensionsCache = null;
let extensionsCacheTime = 0;
const EXTENSIONS_CACHE_TTL_MS = 30_000; // 30 秒

/**
 * 获取所有可用扩展的元数据
 * @param {Object} [options] - 选项
 * @param {boolean} [options.forceRefresh=false] - 强制刷新缓存
 * @returns {Promise<Object>} 包含 agents、commands、skills、hooks、knowledge 数组
 */
export async function getAllExtensions(options = {}) {
    const now = Date.now();
    if (!options.forceRefresh && extensionsCache && (now - extensionsCacheTime) < EXTENSIONS_CACHE_TTL_MS) {
        return extensionsCache;
    }

    const [agents, commands, skills, hooks, knowledge] = await Promise.all([
        readAgents(),
        readCommands(),
        readSkills(),
        readHooks(),
        readKnowledge()
    ]);

    extensionsCache = { agents, commands, skills, hooks, knowledge };
    extensionsCacheTime = now;
    return extensionsCache;
}

/**
 * 清除扩展元数据缓存（扩展文件变更时调用）
 */
export function clearExtensionsCache() {
    extensionsCache = null;
    extensionsCacheTime = 0;
}
