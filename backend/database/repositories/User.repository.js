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
     * @returns {{id: number, username: string}}
     */
    create(username, passwordHash) {
        const stmt = db().prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const result = stmt.run(username, passwordHash);
        return { id: result.lastInsertRowid, username };
    },

    /**
     * 根据用户名获取用户
     * @param {string} username
     * @returns {Object|undefined}
     */
    getByUsername(username) {
        const row = db().prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
        return row;
    },

    /**
     * 根据ID获取用户
     * @param {number} userId
     * @returns {Object|undefined}
     */
    getById(userId) {
        const row = db().prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
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
    },

    /**
     * 根据 external_id 获取用户（SSO 用户）
     * @param {string} externalId - 外部身份提供者的用户 ID
     * @returns {Object|undefined}
     */
    getByExternalId(externalId) {
        const row = db().prepare(
            'SELECT * FROM users WHERE external_id = ? AND is_active = 1'
        ).get(externalId);
        return row;
    },

    /**
     * 通过 SSO 创建新用户
     * @param {Object} userData - 用户数据
     * @param {string} userData.username - 用户名（通常是邮箱）
     * @param {string} userData.email - 邮箱
     * @param {string} userData.identity_provider - 身份提供者（如 'saml'）
     * @param {string} userData.external_id - 外部用户 ID
     * @param {string} userData.first_name - 名（可选）
     * @param {string} userData.last_name - 姓（可选）
     * @param {string} userData.display_name - 显示名称（可选）
     * @returns {{id: number, username: string}}
     */
    createWithSSO({
        username,
        email,
        identity_provider = 'saml',
        external_id,
        first_name = '',
        last_name = '',
        display_name = username
    }) {
        const stmt = db().prepare(`
            INSERT INTO users (
                username,
                password_hash,
                identity_provider,
                external_id,
                sso_enabled,
                has_completed_onboarding,
                display_name,
                first_name,
                last_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            username,
            '', // SSO 用户不需要密码
            identity_provider,
            external_id,
            1, // sso_enabled = true
            0, // has_completed_onboarding = false
            display_name,
            first_name,
            last_name
        );

        return {
            id: result.lastInsertRowid,
            username,
            email,
            identity_provider,
            external_id,
            display_name,
            first_name,
            last_name
        };
    },

    /**
     * 更新用户 SSO 状态
     * @param {number} userId
     * @param {boolean} ssoEnabled
     */
    updateSsoEnabled(userId, ssoEnabled) {
        const stmt = db().prepare('UPDATE users SET sso_enabled = ? WHERE id = ?');
        stmt.run(ssoEnabled ? 1 : 0, userId);
    },

    /**
     * 根据身份提供者和外部 ID 获取用户
     * @param {string} identityProvider - 身份提供者
     * @param {string} externalId - 外部用户 ID
     * @returns {Object|undefined}
     */
    getByIdentityProviderAndExternalId(identityProvider, externalId) {
        const row = db().prepare(`
            SELECT * FROM users
            WHERE identity_provider = ?
            AND external_id = ?
            AND is_active = 1
        `).get(identityProvider, externalId);
        return row;
    }
};
