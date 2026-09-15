/**
 * DirectSessionWriter.js
 *
 * 直连会话 jsonl 写入器：以 Claude SDK 兼容格式把直连对话条目写入用户容器卷。
 * 条目构造为纯函数（可单测）；容器 IO 复用 sessions/container 现有通道。
 *
 * 写入语义：read-modify-write 整文件重写（复用 writeJsonlContentToContainer）。
 * 直连会话是唯一 writer（独立 sessionId，见方案决策三），无双写竞争。
 *
 * @module services/execution/direct/DirectSessionWriter
 */

import { randomUUID } from 'crypto';
import containerManager from '../../container/core/index.js';
import {
  readFileFromContainer,
  writeJsonlContentToContainer,
} from '../../sessions/container/containerFileReader.js';
import { getProjectDir, parseJsonlLines } from '../../sessions/container/sessionReader.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/direct/DirectSessionWriter');

/**
 * 条目 version 字段值——对齐真实 Claude CLI 会话条目（2026-08 真实样本核实为 2.1.199）。
 * 解析器不读此字段，仅为格式 diff 对齐保留。
 */
export const DIRECT_ENTRY_VERSION = '2.1.199';

/**
 * 构造直连 user 条目
 *
 * 首条会话条目必须满足分组四条件（sessionGrouping.js）：
 * {sessionId, type:'user', parentUuid:null, uuid}。
 *
 * @param {Object} params
 * @param {string} params.sessionId - 会话 ID
 * @param {string|null} params.parentUuid - 上一条条目 uuid（首条传 null）
 * @param {string|Array} params.content - 用户内容（字符串或 content blocks）
 * @param {string} params.projectName - 项目名（构造 cwd）
 * @returns {Object} jsonl 条目对象
 */
export function buildUserEntry({ sessionId, parentUuid, content, projectName }) {
  return {
    parentUuid: parentUuid ?? null,
    isSidechain: false,
    userType: 'external',
    cwd: `/workspace/${projectName}`,
    sessionId,
    type: 'user',
    provider: 'direct',
    version: DIRECT_ENTRY_VERSION,
    message: { role: 'user', content },
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * 构造直连 assistant 条目
 *
 * usage 写在条目顶层（TokenUsageCalculator.calculateEntryTokens 读 entry.usage）。
 *
 * @param {Object} params
 * @param {string} params.sessionId - 会话 ID
 * @param {string|null} params.parentUuid - 上一条条目 uuid（通常是本轮 user 条目的 uuid）
 * @param {Array} params.contentBlocks - 模型输出 blocks（[{type:'text'|'thinking',...}]）
 * @param {string} params.model - 模型名
 * @param {Object} params.usage - {input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}
 * @param {string} params.projectName - 项目名（构造 cwd）
 * @returns {Object} jsonl 条目对象
 */
export function buildAssistantEntry({ sessionId, parentUuid, contentBlocks, model, usage, projectName }) {
  return {
    parentUuid: parentUuid ?? null,
    isSidechain: false,
    userType: 'external',
    cwd: `/workspace/${projectName}`,
    sessionId,
    type: 'assistant',
    provider: 'direct',
    version: DIRECT_ENTRY_VERSION,
    message: {
      role: 'assistant',
      model,
      content: contentBlocks,
    },
    usage: normalizeUsage(usage),
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * 归一化 API usage 字段（缺省补 0，剔除额外字段）
 * @param {Object} [apiUsage] - /v1/messages 响应的 usage 对象
 * @returns {Object} 四字段 usage 对象
 */
export function normalizeUsage(apiUsage = {}) {
  return {
    input_tokens: apiUsage.input_tokens || 0,
    output_tokens: apiUsage.output_tokens || 0,
    cache_creation_input_tokens: apiUsage.cache_creation_input_tokens || 0,
    cache_read_input_tokens: apiUsage.cache_read_input_tokens || 0,
  };
}

/**
 * 取条目数组末条 uuid（parentUuid 链接用）
 * @param {Array} entries - jsonl 条目数组
 * @returns {string|null} 末条 uuid；空数组返回 null
 */
export function getLastEntryUuid(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]?.uuid) return entries[i].uuid;
  }
  return null;
}

/**
 * 读取直连会话的全部 jsonl 条目
 *
 * 文件不存在（新会话）返回 []；其余读取异常（exec 超时/流错误）上抛——
 * 若降级为空，appendDirectTurn 的 read-modify-write 会用本轮条目
 * 静默覆盖整个会话文件（历史丢失，不可逆），必须中止本轮。
 *
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Array>} 条目数组；文件不存在返回 []
 * @throws {Error} 读取异常（非文件不存在）
 */
export async function readDirectSessionEntries(userId, projectName, sessionId) {
  const filePath = `${getProjectDir(projectName)}/${sessionId}.jsonl`;
  try {
    const content = await readFileFromContainer(userId, filePath);
    return parseJsonlLines(content);
  } catch (error) {
    if (isSessionFileNotFound(error)) return [];
    logger.error({ err: error, sessionId, filePath }, '[DirectSessionWriter] 会话文件读取异常，上抛中止本轮');
    throw error;
  }
}

/**
 * 判定读取异常是否为"会话文件不存在"（新会话的正常路径）
 *
 * readFileFromContainer 对不存在文件固定抛 'File not found: <path>'
 * （stderr 含 No such file / cannot access 时），以此与超时/流错误区分。
 *
 * @param {Error} error - readFileFromContainer 抛出的错误
 * @returns {boolean} 文件不存在返回 true
 */
export function isSessionFileNotFound(error) {
  return typeof error?.message === 'string' && error.message.startsWith('File not found');
}

/**
 * 追加一轮直连对话（user + assistant 条目）到会话 jsonl
 *
 * 流完成后一次性调用（中断不落盘，方案 4.7）。写入前确保项目目录存在——
 * 从未跑过 Claude 会话的项目没有 .claude/projects/<encoded>/ 目录，
 * 而 shell 写入路径不做 mkdir（writeFileViaShell），必须前置补齐。
 *
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名
 * @param {string} sessionId - 会话 ID
 * @param {Array<Object>} newEntries - 本轮新条目（[userEntry, assistantEntry]）
 * @returns {Promise<void>}
 */
export async function appendDirectTurn(userId, projectName, sessionId, newEntries) {
  const projectDir = getProjectDir(projectName);
  const filePath = `${projectDir}/${sessionId}.jsonl`;

  // mkdir -p：putArchive 路径自带 ensureDir，shell 路径不带，统一前置一次（幂等）
  const { stream } = await containerManager.execInContainer(userId, ['mkdir', '-p', projectDir]);
  stream.destroy?.(); // 不关心输出，立即释放

  const existing = await readDirectSessionEntries(userId, projectName, sessionId);
  const merged = [...existing, ...newEntries];
  await writeJsonlContentToContainer(userId, filePath, merged);

  logger.info({ sessionId, projectName, appended: newEntries.length, total: merged.length }, '[DirectSessionWriter] 会话条目落盘');
}
