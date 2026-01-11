/**
 * GitHub Token 数据仓库
 *
 * 负责 GitHub Token 相关的数据库操作
 *
 * @module database/repositories/GitHubToken.repository
 */

import { getDatabase } from '../connection.js';

const db = getDatabase;

/**
 * GitHub Token 数据仓库
 */
export const GitHubToken = {
    /**
     * 保存GitHub Token
     * @param {number} userId
     * @param {string} token
     */
    save(userId, token) {
        const stmt = db().prepare('INSERT INTO github_tokens (user_id, token) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token');
        stmt.run(userId, token);
    },

    /**
     * 获取GitHub Token
     * @param {number} userId
     * @returns {string|undefined}
     */
    get(userId) {
        const row = db().prepare('SELECT token FROM github_tokens WHERE user_id = ?').get(userId);
        return row?.token;
    },

    /**
     * 获取活动的GitHub Token（别名方法）
     * @param {number} userId
     * @returns {string|undefined}
     */
    getActive(userId) {
        return GitHubToken.get(userId);
    },

    /**
     * 删除GitHub Token
     * @param {number} userId
     */
    delete(userId) {
        const stmt = db().prepare('DELETE FROM github_tokens WHERE user_id = ?');
        stmt.run(userId);
    }
};
