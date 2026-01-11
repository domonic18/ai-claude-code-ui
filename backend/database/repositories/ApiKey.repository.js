/**
 * API密钥数据仓库
 *
 * 负责 API 密钥相关的数据库操作
 *
 * @module database/repositories/ApiKey.repository
 */

import crypto from 'crypto';
import { getDatabase } from '../connection.js';

const db = getDatabase;

/**
 * API密钥数据仓库
 */
export const ApiKey = {
    /**
     * 生成新的API密钥
     * @returns {string}
     */
    generate() {
        return 'ck_' + crypto.randomBytes(32).toString('hex');
    },

    /**
     * 创建新的API密钥
     * @param {number} userId
     * @param {string} keyName
     * @returns {{id: number, keyName: string, apiKey: string}}
     */
    create(userId, keyName) {
        const apiKey = ApiKey.generate();
        const stmt = db().prepare('INSERT INTO api_keys (user_id, key_name, api_key) VALUES (?, ?, ?)');
        const result = stmt.run(userId, keyName, apiKey);
        return { id: result.lastInsertRowid, keyName, apiKey };
    },

    /**
     * 获取用户的所有API密钥
     * @param {number} userId
     * @returns {Array}
     */
    getByUserId(userId) {
        const rows = db().prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        return rows;
    },

    /**
     * 验证API密钥
     * @param {string} apiKey
     * @returns {Object|undefined}
     */
    validate(apiKey) {
        const row = db().prepare(`
            SELECT u.id, u.username, ak.id as api_key_id
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
        `).get(apiKey);

        if (row) {
            db().prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
        }

        return row;
    },

    /**
     * 删除API密钥
     * @param {number} userId
     * @param {number} apiKeyId
     * @returns {boolean}
     */
    delete(userId, apiKeyId) {
        const stmt = db().prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
        const result = stmt.run(apiKeyId, userId);
        return result.changes > 0;
    },

    /**
     * 切换API密钥活动状态
     * @param {number} userId
     * @param {number} apiKeyId
     * @param {boolean} isActive
     * @returns {boolean}
     */
    toggle(userId, apiKeyId, isActive) {
        const stmt = db().prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?');
        const result = stmt.run(isActive ? 1 : 0, apiKeyId, userId);
        return result.changes > 0;
    }
};
