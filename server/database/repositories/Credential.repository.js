/**
 * 用户凭证数据仓库
 *
 * 负责用户凭证相关的数据库操作
 *
 * @module database/repositories/Credential.repository
 */

import { getDatabase } from '../connection.js';

const db = getDatabase;

/**
 * 用户凭证数据仓库
 */
export const Credential = {
    /**
     * 获取用户凭证（可按类型过滤）
     * @param {number} userId
     * @param {string|null} type
     * @returns {Array}
     */
    getByUserId(userId, type = null) {
        let query = 'SELECT id, credential_name, credential_type, description, is_active, created_at FROM user_credentials WHERE user_id = ?';
        const params = [userId];

        if (type) {
            query += ' AND credential_type = ?';
            params.push(type);
        }

        const rows = db().prepare(query).all(...params);
        return rows;
    },

    /**
     * 创建新凭证
     * @param {number} userId
     * @param {string} credentialName
     * @param {string} credentialType
     * @param {string} credentialValue
     * @param {string|null} description
     * @returns {{id: number, credential_name: string, credential_type: string, is_active: boolean}}
     */
    create(userId, credentialName, credentialType, credentialValue, description = null) {
        const stmt = db().prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
        return {
            id: result.lastInsertRowid,
            credential_name: credentialName,
            credential_type: credentialType,
            is_active: true
        };
    },

    /**
     * 删除凭证
     * @param {number} userId
     * @param {number} credentialId
     * @returns {boolean}
     */
    delete(userId, credentialId) {
        const stmt = db().prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
        const result = stmt.run(credentialId, userId);
        return result.changes > 0;
    },

    /**
     * 切换凭证活动状态
     * @param {number} userId
     * @param {number} credentialId
     * @param {boolean} isActive
     * @returns {boolean}
     */
    toggle(userId, credentialId, isActive) {
        const stmt = db().prepare('UPDATE user_credentials SET is_active = ? WHERE id = ? AND user_id = ?');
        const result = stmt.run(isActive ? 1 : 0, credentialId, userId);
        return result.changes > 0;
    }
};
