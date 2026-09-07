/**
 * DirectQuery.js
 *
 * 直连模型编排器：绕过 Claude Agent SDK，宿主机直接调用厂商 Anthropic 兼容端点。
 * 一轮流程：sessionId 解析 → 并发守卫 → 容器拉起 → 上下文重建 → 附件注入 →
 * 流式调用（SSE → direct-response）→ 落盘 → direct-complete。
 *
 * 停止：AbortController（用户 abort / ws 断线 / 超时统一走 controller.abort）。
 * 断线不续传（方案 4.7）；流中断则本轮不落盘。
 *
 * @module services/execution/direct/DirectQuery
 */

import { randomUUID } from 'crypto';
import containerManager from '../../container/core/index.js';
import { getModelProviderConfig } from '../../../config/modelConfig.js';
import { createLogger, sanitizePreview } from '../../../utils/logger.js';
import { streamDirectMessage } from './DirectModelClient.js';
import {
  readDirectSessionEntries,
  appendDirectTurn,
  buildUserEntry,
  buildAssistantEntry,
  getLastEntryUuid,
} from './DirectSessionWriter.js';
import { buildMessagesFromEntries } from './DirectContextBuilder.js';
import { buildDirectUserContent } from './DirectAttachmentInjector.js';

const logger = createLogger('services/execution/direct/DirectQuery');

/** 直连单轮 max_tokens（Anthropic 必填参数；不做配置化） */
const DIRECT_MAX_TOKENS = 8192;

/**
 * 活跃直连会话表：sessionId → { controller, status, model, startedAt, userAborted }
 * 兼作并发守卫（同会话拒绝并发）与 abort 路由
 */
const activeDirectSessions = new Map();

/**
 * 发送 WS 消息（writer 未连接时静默丢弃，与 codexStreamProcessor.sendMessage 语义一致）
 * @param {Object} writer - WebSocketWriter
 * @param {Object} payload - 消息对象
 */
function send(writer, payload) {
  try {
    writer?.send?.(payload);
  } catch (err) {
    logger.debug({ err }, '[DirectQuery] writer 发送失败（连接可能已关闭）');
  }
}

/**
 * 中止直连会话
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 会话存在且已触发中止返回 true
 */
export function abortDirectSession(sessionId) {
  const session = activeDirectSessions.get(sessionId);
  if (!session) return false;
  session.status = 'aborted';
  session.userAborted = true;
  session.controller.abort();
  return true;
}

/**
 * 检查直连会话是否活跃
 * @param {string} sessionId - 会话 ID
 * @returns {boolean}
 */
export function isDirectSessionActive(sessionId) {
  return activeDirectSessions.has(sessionId);
}

/**
 * 获取全部活跃直连会话摘要
 * @returns {Array<{sessionId: string, model: string, startedAt: string}>}
 */
export function getActiveDirectSessions() {
  return Array.from(activeDirectSessions.entries()).map(([sessionId, s]) => ({
    sessionId,
    model: s.model,
    startedAt: s.startedAt,
  }));
}

/**
 * 执行一轮直连对话（编排主入口，签名对齐 queryCodex）
 *
 * @param {string} command - 用户命令
 * @param {Object} options - 选项
 * @param {number} options.userId - 用户 ID
 * @param {string} options.projectPath - 项目名
 * @param {string} [options.sessionId] - 会话 ID（temp-* 前缀或真实 ID）
 * @param {string} options.model - 模型名
 * @param {Array} [attachments] - 附件数组（FileAttachment 结构）
 * @param {Object} writer - WebSocketWriter
 * @returns {Promise<void>}
 */
export async function queryDirect(command, options = {}, attachments = [], writer) {
  const { userId, projectPath: projectName, model } = options;
  const incomingSessionId = options.sessionId || '';
  const isNewSession = !incomingSessionId || incomingSessionId.startsWith('temp-');

  // 新会话：后端生成真实 sessionId 并立即下发（先于任何 delta，消除前端会话过滤竞态；
  // 复用 session-created → handleSessionIdStorage 的 temp→real 替换机制）
  const sessionId = isNewSession ? randomUUID() : incomingSessionId;
  if (isNewSession) {
    send(writer, { type: 'session-created', sessionId, provider: 'direct' });
  }

  // 并发守卫：同会话上一轮未结束，拒绝本轮
  if (activeDirectSessions.has(sessionId)) {
    send(writer, { type: 'direct-error', sessionId, error: '会话正在处理中，请等待本轮完成' });
    return;
  }

  // provider 配置（env 驱动 registry 零改动复用）
  const config = getModelProviderConfig(model || '');
  if (!config?.baseURL || (!config.authToken && !config.apiKey)) {
    send(writer, { type: 'direct-error', sessionId, error: `模型 ${model || '(未指定)'} 缺少 API 配置` });
    return;
  }

  // jsonl 读写依赖容器存活（写会话通道是 Docker API），先拉起
  await containerManager.getOrCreateContainer(userId);

  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const sessionRecord = { controller, status: 'running', model, startedAt, userAborted: false };
  activeDirectSessions.set(sessionId, sessionRecord);

  try {
    logger.info({
      userId, sessionId, model, preview: sanitizePreview(command),
      resume: !isNewSession, attachments: attachments?.length || 0,
    }, '[DirectQuery] 直连请求开始');

    // 上下文重建 + 本轮用户 content
    const entries = isNewSession ? [] : await readDirectSessionEntries(userId, projectName, sessionId);
    const messages = buildMessagesFromEntries(entries);
    const userContent = await buildDirectUserContent(userId, attachments, command);
    messages.push({ role: 'user', content: userContent });

    // 流式调用：转发与 claude-response 内层同构的增量事件
    const result = await streamDirectMessage(
      config,
      { model, messages, maxTokens: DIRECT_MAX_TOKENS },
      {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'content_block_delta' && event.delta) {
            if (typeof event.delta.text === 'string') {
              send(writer, {
                type: 'direct-response', sessionId,
                data: { type: 'content_block_delta', delta: { text: event.delta.text } },
              });
            } else if (typeof event.delta.thinking === 'string') {
              send(writer, {
                type: 'direct-response', sessionId,
                data: { type: 'content_block_delta', delta: { thinking: event.delta.thinking } },
              });
            }
          } else if (event.type === 'content_block_stop') {
            send(writer, { type: 'direct-response', sessionId, data: { type: 'content_block_stop' } });
          }
        },
      },
    );

    // 双路径渲染修复：流结束后补发完整 assistant 消息（前端 onAddMessage 落消息列表）
    if (result.contentBlocks.length > 0) {
      send(writer, {
        type: 'direct-response', sessionId,
        data: { type: 'assistant', content: result.contentBlocks },
      });
    }

    // 落盘本轮 user + assistant 两条（中断不落盘——中断走 catch 分支）
    const parentUuid = getLastEntryUuid(entries);
    const userEntry = buildUserEntry({ sessionId, parentUuid, content: userContent, projectName });
    const assistantEntry = buildAssistantEntry({
      sessionId,
      parentUuid: userEntry.uuid,
      contentBlocks: result.contentBlocks,
      model,
      usage: result.usage,
      projectName,
    });
    await appendDirectTurn(userId, projectName, sessionId, [userEntry, assistantEntry]);

    send(writer, { type: 'direct-complete', sessionId, provider: 'direct', exitCode: 0 });
    logger.info({ sessionId, durationMs: Date.now() - Date.parse(startedAt) }, '[DirectQuery] 直连请求完成');
  } catch (err) {
    if (sessionRecord.userAborted) {
      // 用户主动停止：前端 session-aborted 已复位 UI，后端静默（不弹 error）
      logger.info({ sessionId }, '[DirectQuery] 用户中止直连请求');
    } else {
      const message = err?.name === 'DirectTimeoutError' ? '模型响应超时' : (err?.message || '直连调用失败');
      send(writer, { type: 'direct-error', sessionId, error: message });
      logger.error({ err, sessionId, model }, '[DirectQuery] 直连请求失败');
    }
  } finally {
    activeDirectSessions.delete(sessionId);
  }
}
