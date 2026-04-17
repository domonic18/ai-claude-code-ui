/**
 * Cursor 消息内容解析工具
 *
 * 负责从 Cursor 会话数据中提取和格式化消息内容：
 * - 消息预览提取
 * - 内容文本提取
 * - 消息过滤与格式化
 *
 * @module services/execution/cursor/parsers/CursorMessageParser
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/parsers/CursorMessageParser');

/**
 * 从解析后的 JSON 对象中提取文本内容
 * @param {Object} parsed - 已解析的 JSON
 * @returns {string} 文本内容
 */
function extractContentText(parsed) {
    if (parsed?.content) {
        if (Array.isArray(parsed.content)) {
            const firstText = parsed.content.find(p => p?.type === 'text' && p.text)?.text || '';
            return firstText;
        }
        if (typeof parsed.content === 'string') {
            return parsed.content;
        }
    }
    return '';
}

/**
 * 从 blob 数据中提取文本预览
 * @param {Buffer} data - blob 原始数据
 * @returns {string} 预览文本（最多 100 字符）
 */
export function extractMessagePreview(data) {
    try {
        const raw = data.toString('utf8');
        let preview = '';

        // 尝试直接解析 JSON
        try {
            const parsed = JSON.parse(raw);
            preview = extractContentText(parsed);
        } catch {
            // 清理不可打印字符后尝试
            const cleaned = raw.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end > start) {
                try {
                    const parsed = JSON.parse(cleaned.slice(start, end + 1));
                    preview = extractContentText(parsed);
                } catch {
                    preview = cleaned;
                }
            } else {
                preview = cleaned;
            }
        }

        if (preview && preview.length > 0) {
            return preview.substring(0, 100) + (preview.length > 100 ? '...' : '');
        }
    } catch (e) {
        logger.info('Could not parse blob data:', e.message);
    }
    return '';
}

/**
 * 从排序后的 JSON blob 中过滤系统消息并构建最终消息列表
 * @param {Array} sortedJsonBlobs - 按 DAG 顺序排列的 JSON blob
 * @returns {Array} 过滤后的消息列表
 */
export function filterAndFormatMessages(sortedJsonBlobs) {
    const messages = [];
    for (let idx = 0; idx < sortedJsonBlobs.length; idx++) {
        const blob = sortedJsonBlobs[idx];
        const parsed = blob.parsed;
        if (!parsed) continue;

        const role = parsed?.role || parsed?.message?.role;
        if (role === 'system') continue;

        messages.push({
            id: blob.id,
            sequence: idx + 1,
            rowid: blob.rowid,
            content: parsed
        });
    }
    return messages;
}
