/**
 * Cursor 会话数据解析工具 - 统一导出模块
 *
 * 负责解析 Cursor 会话的原始数据：
 * - Hex 编码/解码
 * - 元数据解析
 * - Blob 数据分类（JSON/Protobuf）
 * - DAG 结构重建与拓扑排序
 * - 消息时间线构建
 *
 * 本模块作为 Barrel 导出文件，从以下子模块导入并重新导出所有功能：
 * - CursorBlobParser: DAG 结构和拓扑排序相关功能
 * - CursorMessageParser: 消息内容提取和格式化功能
 *
 * @module services/execution/cursor/parsers/CursorParsers
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/parsers/CursorParsers');

// ============================================================================
// 时间戳与编码工具函数
// ============================================================================

/**
 * 解析时间戳（支持秒、毫秒、ISO 字符串）
 * @param {number|string} value - 时间戳值
 * @returns {string|null} ISO 格式字符串，解析失败返回 null
 */
export function parseTimestamp(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        const ms = value < 1e12 ? value * 1000 : value;
        return new Date(ms).toISOString();
    }
    if (typeof value === 'string') {
        const n = Number(value);
        if (Number.isFinite(n)) {
            const ms = n < 1e12 ? n * 1000 : n;
            return new Date(ms).toISOString();
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
}

/**
 * 判断字符串是否为 hex 编码
 * @param {string} value - 待检测字符串
 * @returns {boolean}
 */
export function isHexString(value) {
    return /^[0-9a-fA-F]+$/.test(value);
}

/**
 * 解码 hex 编码的 JSON
 * @param {string} hexValue - hex 编码的字符串
 * @returns {Object|null} 解析后的对象，失败返回 null
 */
export function decodeHexJson(hexValue) {
    try {
        const jsonStr = Buffer.from(hexValue, 'hex').toString('utf8');
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

/**
 * 解析 meta 表的行数据为元数据对象
 * @param {Array<{key: string, value: string}>} metaRows - meta 表原始行
 * @returns {Object} 解析后的元数据
 */
export function parseMetadata(metaRows) {
    const metadata = {};
    for (const row of metaRows) {
        if (!row.value) continue;
        metadata[row.key] = decodeMetadataValue(row.value);
    }
    return metadata;
}

/**
 * 解析单行 metadata value
 * @param {*} rawValue - 原始值
 * @returns {string|Object} 解析后的值
 */
function decodeMetadataValue(rawValue) {
    try {
        const strValue = rawValue.toString();
        if (isHexString(strValue)) {
            const decoded = decodeHexJson(strValue);
            if (decoded !== null) return decoded;
        }
        return strValue;
    } catch {
        return rawValue.toString();
    }
}

// ============================================================================
// 从 CursorBlobParser 重新导出
// ============================================================================

export {
    categorizeBlobs,
    topologicalSort,
    buildMessageOrder
} from './CursorBlobParser.js';

// ============================================================================
// 从 CursorMessageParser 重新导出
// ============================================================================

export {
    extractMessagePreview,
    filterAndFormatMessages
} from './CursorMessageParser.js';

// ============================================================================
// 高级组合函数
// ============================================================================

import { categorizeBlobs as _categorizeBlobs, topologicalSort as _topologicalSort, buildMessageOrder as _buildMessageOrder } from './CursorBlobParser.js';
import { filterAndFormatMessages as _filterAndFormatMessages } from './CursorMessageParser.js';

/**
 * 从 blob 数据构建消息时间线（DAG + 拓扑排序）
 * @param {Array<{rowid: number, id: string, data: Buffer}>} allBlobs - 所有 blob
 * @returns {{messages: Array, sortedBlobs: Array}} 排序后的消息和 blob
 */
export function buildMessageTimeline(allBlobs) {
    // 步骤 1：分类 blob
    const { blobMap, parentRefs, jsonBlobs } = _categorizeBlobs(allBlobs);

    // 步骤 2：拓扑排序
    const sorted = _topologicalSort(allBlobs, parentRefs, blobMap);

    // 步骤 3：建立消息出现顺序
    const messageOrder = _buildMessageOrder(sorted, jsonBlobs);

    // 步骤 4：按 DAG 顺序排列 JSON blob
    const sortedJsonBlobs = jsonBlobs.sort((a, b) => {
        const orderA = messageOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const orderB = messageOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.rowid - b.rowid;
    });

    // 步骤 5：过滤系统消息并格式化
    const messages = _filterAndFormatMessages(sortedJsonBlobs);

    return { messages, sortedBlobs: sorted };
}
