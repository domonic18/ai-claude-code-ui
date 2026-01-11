/**
 * 容器数据仓库
 *
 * 负责容器相关的数据库操作
 *
 * @module database/repositories/Container.repository
 */

import { getDatabase } from '../connection.js';

const db = getDatabase;

/**
 * 容器数据仓库
 */
export const Container = {
    /**
     * 创建容器记录
     * @param {number} userId
     * @param {string} containerId
     * @param {string} containerName
     * @returns {{id: number}}
     */
    create(userId, containerId, containerName) {
        const stmt = db().prepare('INSERT INTO user_containers (user_id, container_id, container_name) VALUES (?, ?, ?)');
        const result = stmt.run(userId, containerId, containerName);
        return { id: result.lastInsertRowid };
    },

    /**
     * 根据用户ID获取容器
     * @param {number} userId
     * @returns {Object|undefined}
     */
    getByUserId(userId) {
        const row = db().prepare('SELECT * FROM user_containers WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
        return row;
    },

    /**
     * 根据容器ID获取容器
     * @param {string} containerId
     * @returns {Object|undefined}
     */
    getById(containerId) {
        const row = db().prepare('SELECT * FROM user_containers WHERE container_id = ?').get(containerId);
        return row;
    },

    /**
     * 更新容器状态
     * @param {string} containerId
     * @param {string} status
     */
    updateStatus(containerId, status) {
        const stmt = db().prepare('UPDATE user_containers SET status = ? WHERE container_id = ?');
        stmt.run(status, containerId);
    },

    /**
     * 更新容器最后活动时间
     * @param {string} containerId
     */
    updateLastActive(containerId) {
        const stmt = db().prepare('UPDATE user_containers SET last_active = CURRENT_TIMESTAMP WHERE container_id = ?');
        stmt.run(containerId);
    },

    /**
     * 删除容器记录
     * @param {string} containerId
     */
    delete(containerId) {
        const stmt = db().prepare('DELETE FROM user_containers WHERE container_id = ?');
        stmt.run(containerId);
    },

    /**
     * 列出所有活动容器
     * @returns {Array}
     */
    listActive() {
        const rows = db().prepare('SELECT * FROM user_containers WHERE status = ?').all('running');
        return rows;
    }
};
