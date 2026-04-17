/**
 * Cursor 会话查询服务
 *
 * 负责 Cursor 会话数据的查询和解析：
 * - 会话列表获取（含元数据解析、消息预览）
 * - 单个会话详情（含 DAG 结构重建、消息排序）
 *
 * 架构说明：
 * - CursorRepository: 封装所有 SQLite 数据库操作
 * - CursorParsers: 封装所有数据解析逻辑（hex、JSON、protobuf、DAG）
 * - 本模块: 编排上述模块，提供对外 API
 *
 * @module services/execution/cursor/CursorSessionService
 */

import crypto from 'crypto';
import { createLogger } from '../../../utils/logger.js';
import * as Repo from './CursorRepository.js';
import * as Parsers from './parsers/CursorParsers.js';

const logger = createLogger('services/execution/cursor/CursorSessionService');

/**
 * 计算项目路径的 cwdID 哈希（Cursor 使用 MD5）
 * @param {string} projectPath - 项目路径
 * @returns {string} MD5 哈希值
 */
export function computeCwdId(projectPath) {
    return crypto.createHash('md5').update(projectPath || process.cwd()).digest('hex');
}

// 重新导出解析工具函数（供外部使用）
export const parseTimestamp = Parsers.parseTimestamp;
export const parseMetadata = Parsers.parseMetadata;

/**
 * 获取项目的所有 Cursor 会话列表
 * @param {string} [projectPath] - 项目路径
 * @returns {Promise<{sessions: Array, cwdId: string, path: string}>}
 */
export async function getSessions(projectPath) {
    const cwdId = computeCwdId(projectPath);
    const cursorChatsPath = Repo.getChatsPath(cwdId);

    // 检查目录是否存在
    const exists = await Repo.checkChatsPathExists(cwdId);
    if (!exists) {
        return { sessions: [], cwdId, path: cursorChatsPath };
    }

    const sessionDirs = await Repo.listSessionDirs(cwdId);
    const sessions = [];

    for (const sessionId of sessionDirs) {
        const sessionData = await parseSessionListEntry(sessionId, projectPath, cwdId);
        if (sessionData) {
            sessions.push(sessionData);
        }
    }

    // 按创建时间降序排序
    sessions.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return { sessions, cwdId, path: cursorChatsPath };
}

/**
 * 解析会话列表中的单个会话
 * @param {string} sessionId - 会话 ID
 * @param {string} projectPath - 项目路径
 * @param {string} cwdId - 项目哈希 ID
 * @returns {Promise<Object|null>} 会话数据，失败返回 null
 */
async function parseSessionListEntry(sessionId, projectPath, cwdId) {
    try {
        // 检查数据库是否存在
        const dbExists = await Repo.checkSessionDbExists(cwdId, sessionId);
        if (!dbExists) {
            return null;
        }

        // 获取文件修改时间作为备用时间戳
        const dbStatMtimeMs = await Repo.getSessionDbMtime(cwdId, sessionId);

        // 打开数据库并解析
        const db = await Repo.openSessionDb(sessionId, cwdId);

        const metaRows = await Repo.queryMetadata(db);
        const metadata = Parsers.parseMetadata(metaRows);

        const messageCount = await Repo.queryMessageCount(db);
        const lastBlob = await Repo.queryLastMessage(db);

        await Repo.closeSessionDb(db);

        // 构建会话数据对象
        const sessionData = buildSessionData(
            sessionId,
            projectPath,
            metadata,
            messageCount,
            lastBlob,
            dbStatMtimeMs
        );

        return sessionData;
    } catch (error) {
        logger.info(`Could not read session ${sessionId}:`, error.message);
        return null;
    }
}

/**
 * 从解析的数据构建会话对象
 * @param {string} sessionId - 会话 ID
 * @param {string} projectPath - 项目路径
 * @param {Object} metadata - 元数据
 * @param {number} messageCount - 消息数量
 * @param {Object} lastBlob - 最后一条消息的 blob
 * @param {number|null} dbStatMtimeMs - 数据库修改时间
 * @returns {Object} 会话数据
 */
function buildSessionData(sessionId, projectPath, metadata, messageCount, lastBlob, dbStatMtimeMs) {
    let sessionData = {
        id: sessionId,
        name: 'Untitled Session',
        createdAt: null,
        mode: null,
        projectPath,
        lastMessage: null,
        messageCount
    };

    // 从 agent 元数据中提取会话信息
    if (metadata.agent) {
        const agent = metadata.agent;
        sessionData.name = agent.name || sessionData.name;
        sessionData.createdAt = Parsers.parseTimestamp(agent.createdAt);
        sessionData.mode = agent.mode;
        sessionData.agentId = agent.agentId;
        sessionData.latestRootBlobId = agent.latestRootBlobId;
    } else if (metadata.name) {
        sessionData.name = metadata.name;
    }

    // 回退：使用文件修改时间
    if (!sessionData.createdAt && dbStatMtimeMs && Number.isFinite(dbStatMtimeMs)) {
        sessionData.createdAt = new Date(dbStatMtimeMs).toISOString();
    }

    // 提取最后一条消息预览
    if (lastBlob?.data) {
        sessionData.lastMessage = Parsers.extractMessagePreview(lastBlob.data);
    }

    return sessionData;
}

/**
 * 获取单个会话的详细信息（含消息 DAG 和时间排序）
 * @param {string} sessionId - 会话 ID
 * @param {string} [projectPath] - 项目路径
 * @returns {Promise<Object>} 会话详情
 */
export async function getSessionDetail(sessionId, projectPath) {
    const cwdId = computeCwdId(projectPath);

    const db = await Repo.openSessionDb(sessionId, cwdId);

    // 获取所有 blob 构建 DAG
    const allBlobs = await Repo.queryAllBlobs(db);
    const { messages } = Parsers.buildMessageTimeline(allBlobs);

    // 获取元数据
    const metaRows = await Repo.queryMetadata(db);
    const metadata = Parsers.parseMetadata(metaRows);

    await Repo.closeSessionDb(db);

    return {
        id: sessionId,
        projectPath,
        messages,
        metadata,
        cwdId
    };
}
