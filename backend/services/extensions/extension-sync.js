/**
 * Extension 同步服务
 *
 * 将预配置的扩展（agents、commands、skills、hooks、knowledge）
 * 和配置文件（CLAUDE.md、settings.json）从项目根 extensions/.claude/
 * 同步到用户的 .claude/ 目录。
 *
 * 路由层和其他服务通过此模块访问所有 extension 功能。
 *
 * @module services/extensions/extension-sync
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
    EXTENSIONS_DIR,
    FILE_EXTENSIONS,
    directoryExists,
    fileExists,
    copyDirectory
} from './extension-utils.js';
import {
    syncResourceType,
    syncSkillEntry,
    syncFlexibleEntry,
    syncFileEntry,
    syncConfigFiles
} from './extension-sync-sync.js';

const logger = createLogger('services/extensions/extension-sync');

// ─── 同步操作 ────────────────────────────────────────

/**
 * 同步预配置扩展到用户目录
 *
 * @param {string} targetDir - 目标 .claude 目录（如 workspace/users/user_1/data/.claude）
 * @param {Object} options - 同步选项
 * @param {boolean} options.overwriteUserFiles - 是否覆盖已有用户文件（默认 true）
 * @returns {Promise<Object>} 同步结果（各类型的 synced 计数和 errors 数组）
 */
export async function syncExtensions(targetDir, options = {}) {
    const { overwriteUserFiles = true } = options;

    const results = {
        agents: { synced: 0, errors: [] },
        commands: { synced: 0, errors: [] },
        skills: { synced: 0, errors: [] },
        hooks: { synced: 0, errors: [] },
        knowledge: { synced: 0, errors: [] },
        config: { synced: 0, errors: [] }
    };

    try {
        // 确保目标子目录存在
        const subdirs = ['agents', 'commands', 'skills', 'hooks', 'knowledge'];
        await Promise.all(subdirs.map(dir => fs.mkdir(path.join(targetDir, dir), { recursive: true })));

        // 并行同步各类型（独立操作，无相互依赖）
        await Promise.all([
            syncResourceType('agents', targetDir, results.agents, overwriteUserFiles),
            syncResourceType('commands', targetDir, results.commands, overwriteUserFiles),
            syncResourceType('skills', targetDir, results.skills, overwriteUserFiles),
            syncResourceType('hooks', targetDir, results.hooks, overwriteUserFiles),
            syncResourceType('knowledge', targetDir, results.knowledge, overwriteUserFiles),
            syncConfigFiles(targetDir, results.config, overwriteUserFiles),
        ]);

        // 汇总日志
        const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);
        if (totalSynced > 0) {
            const parts = Object.entries(results)
                .filter(([, r]) => r.synced > 0)
                .map(([type, r]) => `${r.synced} ${type}`);
            logger.info(`[ExtensionSync] Synced ${totalSynced} extensions (${parts.join(', ')})`);
        }

        return results;
    } catch (error) {
        logger.error('[ExtensionSync] Failed to sync extensions:', error);
        throw error;
    }
}

/**
 * 同步扩展到所有用户
 *
 * @param {Object} options - 同步选项
 * @param {boolean} options.overwriteUserFiles - 是否覆盖已有用户文件（默认 false）
 * @returns {Promise<Object>} 同步结果（total、synced、failed、errors）
 */
export async function syncToAllUsers(options = {}) {
    const { overwriteUserFiles = false } = options;

    const { repositories } = await import('../../database/db.js');
    const { User } = repositories;
    const { getWorkspaceDir } = await import('../../config/config.js');

    const users = User.getAll();
    const workspaceDir = getWorkspaceDir();

    const results = { total: users.length, synced: 0, failed: 0, errors: [] };

    for (const user of users) {
        try {
            const claudeDir = path.join(workspaceDir, 'users', `user_${user.id}`, 'data', '.claude');
            await syncExtensions(claudeDir, { overwriteUserFiles });
            results.synced++;
            logger.info(`[ExtensionSync] Synced extensions for user ${user.id} (${user.username})`);
        } catch (error) {
            results.failed++;
            results.errors.push({ userId: user.id, username: user.username, error: error.message });
            logger.error({ err: error, userId: user.id }, 'Extension sync failed for user');
        }
    }

    return results;
}

// ─── 重新导出公共 API ─────────────────────────────────

import { getAllExtensions, clearExtensionsCache } from './extension-reader.js';
import { loadAgentsForSDK, loadSkillsForSDK } from './extension-sdk-loader.js';

export { getAllExtensions, clearExtensionsCache, loadAgentsForSDK, loadSkillsForSDK };

export default {
    syncExtensions,
    syncToAllUsers,
    getAllExtensions,
    loadAgentsForSDK,
    loadSkillsForSDK
};
