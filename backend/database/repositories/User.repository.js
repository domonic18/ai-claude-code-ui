/**
 * 用户数据仓库
 *
 * 负责用户相关的数据库操作
 *
 * @module database/repositories/User.repository
 */

import { getDatabase } from '../connection.js';

const db = getDatabase;

/**
 * 用户数据仓库
 */
export const User = {
    /**
     * 检查是否存在任何用户
     * @returns {boolean}
     */
    hasUsers() {
        const row = db().prepare('SELECT COUNT(*) as count FROM users').get();
        return row.count > 0;
    },

    /**
     * 创建新用户
     * @param {string} username - 用户名
     * @param {string} passwordHash - 密码哈希
     * @param {string} role - 用户角色 ('admin', 'user', 'guest')
     * @returns {{id: number, username: string, role: string}}
     */
    create(username, passwordHash, role = 'user') {
        const stmt = db().prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        const result = stmt.run(username, passwordHash, role);
        return { id: result.lastInsertRowid, username, role };
    },

    /**
     * 根据用户名获取用户
     * @param {string} username
     * @returns {Object|undefined}
     */
    getByUsername(username) {
        const row = db().prepare('SELECT id, username, password_hash, role, created_at, last_login FROM users WHERE username = ? AND is_active = 1').get(username);
        return row;
    },

    /**
     * 根据ID获取用户
     * @param {number} userId
     * @returns {Object|undefined}
     */
    getById(userId) {
        const row = db().prepare('SELECT id, username, role, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
        return row;
    },

    /**
     * 获取第一个（唯一）用户
     * @returns {Object|undefined}
     */
    getFirst() {
        const row = db().prepare('SELECT id, username, created_at, last_login FROM users WHERE is_active = 1 LIMIT 1').get();
        return row;
    },

    /**
     * 获取所有用户
     * @returns {Array}
     */
    getAll() {
        const rows = db().prepare('SELECT id, username, created_at, last_login FROM users WHERE is_active = 1').all();
        return rows;
    },

    /**
     * 更新最后登录时间
     * @param {number} userId
     */
    updateLastLogin(userId) {
        db().prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    },

    /**
     * 更新Git配置
     * @param {number} userId
     * @param {string} gitName
     * @param {string} gitEmail
     */
    updateGitConfig(userId, gitName, gitEmail) {
        const stmt = db().prepare('UPDATE users SET git_name = ?, git_email = ? WHERE id = ?');
        stmt.run(gitName, gitEmail, userId);
    },

    /**
     * 获取Git配置
     * @param {number} userId
     * @returns {{git_name: string, git_email: string}|undefined}
     */
    getGitConfig(userId) {
        const row = db().prepare('SELECT git_name, git_email FROM users WHERE id = ?').get(userId);
        return row;
    },

    /**
     * 完成用户引导
     * @param {number} userId
     */
    completeOnboarding(userId) {
        const stmt = db().prepare('UPDATE users SET has_completed_onboarding = 1 WHERE id = ?');
        stmt.run(userId);
    },

    /**
     * 检查是否完成引导
     * @param {number} userId
     * @returns {boolean}
     */
    hasCompletedOnboarding(userId) {
        const row = db().prepare('SELECT has_completed_onboarding FROM users WHERE id = ?').get(userId);
        return row?.has_completed_onboarding === 1;
    },

    /**
     * 更新容器层级
     * @param {number} userId
     * @param {string} tier
     */
    updateContainerTier(userId, tier) {
        const stmt = db().prepare('UPDATE users SET container_tier = ? WHERE id = ?');
        stmt.run(tier, userId);
    },

    /**
     * 获取容器层级
     * @param {number} userId
     * @returns {string}
     */
    getContainerTier(userId) {
        const row = db().prepare('SELECT container_tier FROM users WHERE id = ?').get(userId);
        return row?.container_tier || 'free';
    },

    /**
     * 更新容器配置
     * @param {number} userId
     * @param {Object} config
     */
    updateContainerConfig(userId, config) {
        const stmt = db().prepare('UPDATE users SET container_config = ? WHERE id = ?');
        stmt.run(JSON.stringify(config), userId);
    },

    /**
     * 获取容器配置
     * @param {number} userId
     * @returns {Object|null}
     */
    getContainerConfig(userId) {
        const row = db().prepare('SELECT container_config FROM users WHERE id = ?').get(userId);
        if (!row?.container_config) return null;
        try {
            return JSON.parse(row.container_config);
        } catch {
            return null;
        }
    }
};
