/**
 * Extension SDK 加载器
 *
 * 为 Claude Agent SDK 加载预配置的 agents 和 skills。
 * Agents 从 markdown 文件加载（带 YAML frontmatter），
 * Skills 从子目录中的 SKILL.md 文件加载。
 *
 * @module services/extensions/extension-sdk-loader
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
    EXTENSIONS_DIR,
    directoryExists,
    fileExists,
    parseFrontmatter
} from './extension-utils.js';

const logger = createLogger('services/extensions/extension-sdk-loader');

/**
 * 加载 skills 列表（SDK 格式）
 *
 * 读取 extensions/.claude/skills/ 下的所有有效 skill 目录，
 * 返回 skill 名称数组供 agent 引用。
 *
 * @returns {Promise<string[]>} Skill 名称数组
 * @example
 * ['patent-tech-disclosure', 'technical-tech-solution', 'patent-three-elements-generator']
 */
export async function loadSkillsForSDK() {
    const skillsDir = path.join(EXTENSIONS_DIR, 'skills');

    if (!(await directoryExists(skillsDir))) {
        logger.warn('[ExtensionSDK] Skills directory not found:', skillsDir);
        return [];
    }

    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (await fileExists(skillMdPath)) {
            skills.push(entry.name);
        }
    }

    logger.info(`[ExtensionSDK] Loaded ${skills.length} skills for SDK`);
    return skills;
}

/**
 * 加载 agents（SDK 格式）
 *
 * 读取 extensions/.claude/agents/ 下的 markdown 文件，
 * 解析 YAML frontmatter（name, description, tools），
 * 返回 SDK 兼容的 agent 定义对象。
 *
 * @returns {Promise<Object>} Agent 定义对象，key 为 agent 名称
 * @example
 * {
 *   'generate-docs-agent': {
 *     description: '文档生成工作流编排器',
 *     tools: ['Skill', 'Task', 'Read'],
 *     prompt: '你是智能文档生成专家...',
 *     skills: ['skill-a', 'skill-b']
 *   }
 * }
 */
export async function loadAgentsForSDK() {
    const agentsDir = path.join(EXTENSIONS_DIR, 'agents');

    if (!(await directoryExists(agentsDir))) {
        logger.warn('[ExtensionSDK] Agents directory not found:', agentsDir);
        return {};
    }

    // 预加载 skills 列表，供所有 agent 共享
    const skillNames = await loadSkillsForSDK();
    logger.info(`[ExtensionSDK] Preloaded ${skillNames.length} skills for agents`);

    const agents = {};
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('.') || entry.name.toLowerCase() === 'readme.md') {
            continue;
        }

        const filePath = path.join(agentsDir, entry.name);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const frontmatter = parseFrontmatter(content);

            // 提取 prompt（frontmatter 之后的内容）
            const promptMatch = content.match(/^---[\s\S]*?---\n([\s\S]*)$/);
            const prompt = promptMatch ? promptMatch[1].trim() : content;

            const name = frontmatter.name || entry.name.replace('.md', '');
            const description = frontmatter.description || '';
            const tools = frontmatter.tools || ['Skill', 'Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];

            // 确保 tools 是数组
            const toolsArray = Array.isArray(tools) ? tools : [tools];

            const agentDef = { description, tools: toolsArray, prompt };

            // 将所有 skills 添加到 agent，使子 agent 也能使用 skills
            if (skillNames.length > 0) {
                agentDef.skills = skillNames;
            }

            agents[name] = agentDef;
            logger.info(`[ExtensionSDK] Loaded agent: ${name} with ${skillNames.length} skills`);
        } catch (error) {
            logger.error(`[ExtensionSDK] Failed to load agent ${entry.name}:`, error.message);
        }
    }

    logger.info(`[ExtensionSDK] Loaded ${Object.keys(agents).length} agents for SDK`);
    return agents;
}
