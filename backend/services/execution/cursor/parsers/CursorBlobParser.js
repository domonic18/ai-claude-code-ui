/**
 * Cursor Blob 数据解析工具 - DAG 结构与拓扑排序
 *
 * 负责处理 Cursor 会话中的 Blob 数据分类和 DAG 结构重建：
 * - Blob 分类（JSON/Protobuf）
 * - 父引用提取
 * - 拓扑排序
 * - 消息顺序建立
 *
 * @module services/execution/cursor/parsers/CursorBlobParser
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('services/execution/cursor/parsers/CursorBlobParser');

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
 * 检查 blob 数据中是否包含指定 jsonBlob 的 ID 引用
 * @param {Object} blob - protobuf blob
 * @param {Object} jsonBlob - JSON blob
 * @returns {boolean} 是否包含引用
 */
function blobContainsJsonId(blob, jsonBlob) {
    try {
        const jsonIdBytes = Buffer.from(jsonBlob.id, 'hex');
        return blob.data.includes(jsonIdBytes);
    } catch {
        return false;
    }
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
        if (!blob.data || blob.data[0] === 0x7B) continue;

        for (const jsonBlob of jsonBlobs) {
            if (blobContainsJsonId(blob, jsonBlob) && !messageOrder.has(jsonBlob.id)) {
                messageOrder.set(jsonBlob.id, orderIndex++);
            }
        }
    }

    return messageOrder;
}
