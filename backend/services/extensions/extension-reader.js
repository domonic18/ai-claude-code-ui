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

// ─── 各类型读取函数 ───────────────────────────────────

/**
 * 读取 agents 目录的元数据
 * @returns {Promise<Array<{filename: string, name: string, description: string}>>}
 */
async function readAgents() {
    const agents = [];
    const agentsDir = path.join(EXTENSIONS_DIR, 'agents');
    if (!(await directoryExists(agentsDir))) return agents;

    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
            const filePath = path.join(agentsDir, entry.name);
            try {
                const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
                agents.push({
                    filename: entry.name,
                    name: content.name || entry.name.replace('.json', ''),
                    description: content.description || ''
                });
            } catch {
                agents.push({
                    filename: entry.name,
                    name: entry.name.replace('.json', ''),
                    description: '[解析失败]'
                });
            }
        }
    }
    return agents;
}

/**
 * 读取 commands 目录的元数据
 * @returns {Promise<Array<{filename: string, name: string}>>}
 */
async function readCommands() {
    const commands = [];
    const commandsDir = path.join(EXTENSIONS_DIR, 'commands');
    if (!(await directoryExists(commandsDir))) return commands;

    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            commands.push({ filename: entry.name, name: entry.name.replace('.md', '') });
        }
    }
    return commands;
}

/**
 * 读取 skills 目录的元数据
 * @returns {Promise<Array<{name: string, description: string}>>}
 */
async function readSkills() {
    const skills = [];
    const skillsDir = path.join(EXTENSIONS_DIR, 'skills');
    if (!(await directoryExists(skillsDir))) return skills;

    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
            let description = '';
            if (await fileExists(skillMdPath)) {
                try {
                    const content = await fs.readFile(skillMdPath, 'utf-8');
                    description = extractMarkdownTitle(content);
                } catch {
                    description = '[无法读取]';
                }
            }
            skills.push({ name: entry.name, description });
        }
    }
    return skills;
}

/**
 * 读取 hooks 目录的元数据
 * @returns {Promise<Array<{filename: string, name: string, type: string, description: string}>>}
 */
async function readHooks() {
    const hooks = [];
    const hooksDir = path.join(EXTENSIONS_DIR, 'hooks');
    if (!(await directoryExists(hooksDir))) return hooks;

    const allowedExts = FILE_EXTENSIONS.hooks;
    const entries = await fs.readdir(hooksDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name);
        if (!allowedExts.includes(ext)) continue;

        const filePath = path.join(hooksDir, entry.name);
        let description = '';

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            description = extractDescription(ext, content);
        } catch {
            description = extractDescription(ext, '');
        }

        hooks.push({
            filename: entry.name,
            name: entry.name.replace(/\.(js|md|sh|py)$/, ''),
            type: ext.substring(1),
            description
        });
    }
    return hooks;
}

/**
 * 读取 knowledge 目录的元数据
 * @returns {Promise<Array<{filename: string, name: string, type: string, description: string}>>}
 */
async function readKnowledge() {
    const knowledge = [];
    const knowledgeDir = path.join(EXTENSIONS_DIR, 'knowledge');
    if (!(await directoryExists(knowledgeDir))) return knowledge;

    const allowedExts = FILE_EXTENSIONS.knowledge;
    const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (!allowedExts.includes(ext)) continue;

            const filePath = path.join(knowledgeDir, entry.name);
            let description = '';

            try {
                const content = await fs.readFile(filePath, 'utf-8');
                description = ext === '.md'
                    ? extractMarkdownTitle(content) || content.substring(0, 100).trim()
                    : content.substring(0, 100).trim();
            } catch {
                description = 'Knowledge File';
            }

            knowledge.push({
                filename: entry.name,
                name: entry.name.replace(/\.(md|txt)$/, ''),
                type: ext.substring(1),
                description
            });
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            knowledge.push({
                filename: entry.name + '/',
                name: entry.name,
                type: 'dir',
                description: 'Knowledge Directory'
            });
        }
    }
    return knowledge;
}

// ─── 公共 API ─────────────────────────────────────────

/**
 * 获取所有可用扩展的元数据
 * @returns {Promise<Object>} 包含 agents、commands、skills、hooks、knowledge 数组
 */
export async function getAllExtensions() {
    const [agents, commands, skills, hooks, knowledge] = await Promise.all([
        readAgents(),
        readCommands(),
        readSkills(),
        readHooks(),
        readKnowledge()
    ]);

    return { agents, commands, skills, hooks, knowledge };
}
