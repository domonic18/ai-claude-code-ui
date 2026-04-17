/**
 * Cursor 会话数据解析工具
 *
 * 负责解析 Cursor 会话的原始数据：
 * - Hex 编码/解码
 * - 元数据解析
 * - Blob 数据分类（JSON/Protobuf）
 * - DAG 结构重建与拓扑排序
 * - 消息时间线构建
 *
 * @module services/execution/cursor/parsers/CursorParsers
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/parsers/CursorParsers');

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
        if (row.value) {
            try {
                const strValue = row.value.toString();
                if (isHexString(strValue)) {
                    const decoded = decodeHexJson(strValue);
                    if (decoded !== null) {
                        metadata[row.key] = decoded;
                        continue;
                    }
                }
                metadata[row.key] = strValue;
            } catch {
                metadata[row.key] = row.value.toString();
            }
        }
    }
    return metadata;
}

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
 * 将 blob 分类为 JSON 消息和 protobuf DAG 结构
 * @param {Array<{rowid: number, id: string, data: Buffer}>} allBlobs - 所有 blob
 * @returns {{blobMap: Map, parentRefs: Map, jsonBlobs: Array}} 分类结果
 */
export function categorizeBlobs(allBlobs) {
    const blobMap = new Map();
    const parentRefs = new Map();
    const jsonBlobs = [];

    for (const blob of allBlobs) {
        blobMap.set(blob.id, blob);

        if (blob.data && blob.data[0] === 0x7B) {
            // JSON blob（实际消息）
            try {
                const parsed = JSON.parse(blob.data.toString('utf8'));
                jsonBlobs.push({ ...blob, parsed });
            } catch {
                logger.info('Failed to parse JSON blob:', blob.rowid);
            }
        } else if (blob.data) {
            // Protobuf blob（DAG 结构）- 提取父引用
            const parents = extractParentRefs(blob, blobMap);
            if (parents.length > 0) {
                parentRefs.set(blob.id, parents);
            }
        }
    }

    return { blobMap, parentRefs, jsonBlobs };
}

/**
 * 从 protobuf blob 中提取父引用
 * @param {Object} blob - blob 对象
 * @param {Map} blobMap - 所有 blob 的映射
 * @returns {Array<string>} 父 blob ID 列表
 */
function extractParentRefs(blob, blobMap) {
    const parents = [];
    let i = 0;

    while (i < blob.data.length - 33) {
        if (blob.data[i] === 0x0A && blob.data[i + 1] === 0x20) {
            const parentHash = blob.data.slice(i + 2, i + 34).toString('hex');
            if (blobMap.has(parentHash)) {
                parents.push(parentHash);
            }
            i += 34;
        } else {
            i++;
        }
    }

    return parents;
}

/**
 * 基于深度优先搜索的拓扑排序
 * @param {Array} allBlobs - 所有 blob
 * @param {Map} parentRefs - 父引用映射
 * @param {Map} blobMap - blob 映射
 * @returns {Array} 拓扑排序后的 blob
 */
export function topologicalSort(allBlobs, parentRefs, blobMap) {
    const visited = new Set();
    const sorted = [];

    function visit(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const parents = parentRefs.get(nodeId) || [];
        for (const parentId of parents) {
            visit(parentId);
        }

        const blob = blobMap.get(nodeId);
        if (blob) {
            sorted.push(blob);
        }
    }

    // 从根节点开始
    for (const blob of allBlobs) {
        if (!parentRefs.has(blob.id)) {
            visit(blob.id);
        }
    }

    // 处理断开连接的组件
    for (const blob of allBlobs) {
        visit(blob.id);
    }

    return sorted;
}

/**
 * 根据拓扑排序结果建立 JSON blob 的出现顺序
 * @param {Array} sortedBlobs - 拓扑排序后的 blob
 * @param {Array} jsonBlobs - JSON blob 列表
 * @returns {Map<string, number>} blob ID -> 顺序索引
 */
export function buildMessageOrder(sortedBlobs, jsonBlobs) {
    const messageOrder = new Map();
    let orderIndex = 0;

    for (const blob of sortedBlobs) {
        if (blob.data && blob.data[0] !== 0x7B) {
            for (const jsonBlob of jsonBlobs) {
                try {
                    const jsonIdBytes = Buffer.from(jsonBlob.id, 'hex');
                    if (blob.data.includes(jsonIdBytes)) {
                        if (!messageOrder.has(jsonBlob.id)) {
                            messageOrder.set(jsonBlob.id, orderIndex++);
                        }
                    }
                } catch {
                    // 跳过无法转换的 ID
                }
            }
        }
    }

    return messageOrder;
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

/**
 * 从 blob 数据构建消息时间线（DAG + 拓扑排序）
 * @param {Array<{rowid: number, id: string, data: Buffer}>} allBlobs - 所有 blob
 * @returns {{messages: Array, sortedBlobs: Array}} 排序后的消息和 blob
 */
export function buildMessageTimeline(allBlobs) {
    // 步骤 1：分类 blob
    const { blobMap, parentRefs, jsonBlobs } = categorizeBlobs(allBlobs);

    // 步骤 2：拓扑排序
    const sorted = topologicalSort(allBlobs, parentRefs, blobMap);

    // 步骤 3：建立消息出现顺序
    const messageOrder = buildMessageOrder(sorted, jsonBlobs);

    // 步骤 4：按 DAG 顺序排列 JSON blob
    const sortedJsonBlobs = jsonBlobs.sort((a, b) => {
        const orderA = messageOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const orderB = messageOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.rowid - b.rowid;
    });

    // 步骤 5：过滤系统消息并格式化
    const messages = filterAndFormatMessages(sortedJsonBlobs);

    return { messages, sortedBlobs: sorted };
}
