/**
 * DirectQuery.js
 *
 * 直连模型编排器：绕过 Claude Agent SDK，宿主机直接调用厂商 Anthropic 兼容端点。
 * 一轮流程：sessionId 解析 → 并发守卫 → 容器拉起 → 上下文重建 → 附件注入 →
 * 受限工具回路（流式调用 → write_generated_doc 执行 → tool_result 回填，见
 * DirectToolLoop）→ 落盘 → direct-complete。
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
import { documentService } from '../../documents/DocumentService.js';
import { runDirectConversation } from './DirectToolLoop.js';
import { writeGeneratedDoc, WRITE_GENERATED_DOC_TOOL } from './DirectDocTool.js';
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
 * 合法直连 sessionId 形态：真实会话为 UUID；新会话为 temp- 前缀
 * （前端 temp-时间戳 / 跨 provider 守卫降级 temp-UUID）。
 * sessionId 直接拼进容器 jsonl 路径（read/write 两处），必须白名单防路径遍历。
 */
const DIRECT_SESSION_ID_PATTERN = /^(?:temp-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * 校验直连 sessionId 是否为合法形态（边界校验，防 jsonl 路径遍历）
 * @param {string} sessionId - 待校验的会话 ID
 * @returns {boolean}
 */
export function isValidDirectSessionId(sessionId) {
  return typeof sessionId === 'string' && DIRECT_SESSION_ID_PATTERN.test(sessionId);
}

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
 * 文档写入成功后通知前端并记录 manifest（对齐 SDK 链 _trackAIDocument 语义）
 *
 * 立即发 document-created（前端乐观层即时上屏，形状与 SDK 完全同构、
 * 不带顶层 sessionId 故不被会话过滤）；recordAIDocument 涉及 Docker IO
 * 可能数秒，fire-and-forget 不阻塞工具回路，完成后由前端 refetch 确认。
 *
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名
 * @param {string} sessionId - 会话 ID
 * @param {{id: string}} toolUse - 触发写入的 tool_use 块（id 作 message_id）
 * @param {{path: string, file_name: string}} writeResult - writeGeneratedDoc 成功结果
 * @param {Object} writer - WebSocketWriter
 */
function notifyDocCreatedAndRecord(userId, projectName, sessionId, toolUse, writeResult, writer) {
  send(writer, {
    type: 'document-created',
    data: {
      file_path: writeResult.path,
      file_name: writeResult.file_name,
      conversation_id: sessionId,
      message_id: toolUse.id,
      type: 'ai_generated',
    },
  });
  documentService.recordAIDocument(userId, projectName, {
    file_path: writeResult.path,
    conversation_id: sessionId,
    message_id: toolUse.id,
  }).catch(err => {
    logger.warn({ err, sessionId, filePath: writeResult.path }, '[DirectQuery] 直连文档 manifest 记录失败');
  });
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

  // sessionId 白名单（边界校验）：伪造消息可借 ../ 越界读写容器内任意 *.jsonl
  if (incomingSessionId && !isValidDirectSessionId(incomingSessionId)) {
    logger.warn({ userId, sessionId: incomingSessionId }, '[DirectQuery] 非法 sessionId，拒绝请求');
    send(writer, { type: 'direct-error', sessionId: incomingSessionId, error: '非法会话 ID' });
    return;
  }

  // projectName 形态校验（边界加固）：projectName 是附件白名单/doc 工具写入/jsonl cwd
  // 的共同锚点，入口统一拦截穿越形态，防未来新增代码路径绕过各自的内部校验
  if (typeof projectName !== 'string'
    || projectName.length === 0
    || projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) {
    logger.warn({ userId, projectName }, '[DirectQuery] 非法项目名，拒绝请求');
    send(writer, { type: 'direct-error', sessionId: incomingSessionId, error: '非法项目名' });
    return;
  }

  // jsonl 读写依赖容器存活（写会话通道是 Docker API），先拉起。
  // 提前到 sessionId 分配前：跨 provider 守卫需要读文件判定归属。
  await containerManager.getOrCreateContainer(userId);

  // 跨 provider 守卫：续聊目标若不是直连创建的会话（首条无 provider:'direct' 标记），
  // 重新分配新 sessionId 独立成会——直连 resume 进 SDK 会话会造成反向混写（决策三：
  // 两套会话完全独立）。读历史失败（非文件不存在）fail-closed 拒绝本轮——若放行，
  // 落盘阶段同样的读取失败会导致整文件被本轮条目覆盖（历史丢失，不可逆）。
  let sessionId = incomingSessionId;
  let mustStartFresh = isNewSession;
  /** 守卫阶段读到的既有条目（resume 时复用，避免二次读容器文件） */
  let existingEntries = [];
  if (!isNewSession) {
    try {
      existingEntries = await readDirectSessionEntries(userId, projectName, incomingSessionId);
    } catch (err) {
      logger.error({ err, userId, sessionId: incomingSessionId }, '[DirectQuery] 会话历史读取失败，拒绝本轮');
      send(writer, { type: 'direct-error', sessionId: incomingSessionId, error: '会话历史读取失败，请稍后重试' });
      return;
    }
    if (existingEntries.length > 0 && existingEntries[0].provider !== 'direct') {
      logger.warn({
        userId, sessionId: incomingSessionId, projectName, reason: 'session-not-direct',
      }, '[DirectQuery] Resume blocked: session was not created by direct provider, starting fresh session');
      mustStartFresh = true;
      existingEntries = [];
    }
  }
  if (mustStartFresh) {
    sessionId = randomUUID();
    // 下发新 sessionId（前端 temp→real 替换机制同样适用于 real→real 换绑）
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

  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const sessionRecord = { controller, status: 'running', model, startedAt, userAborted: false };
  activeDirectSessions.set(sessionId, sessionRecord);

  try {
    logger.info({
      userId, sessionId, model, preview: sanitizePreview(command),
      resume: !mustStartFresh, attachments: attachments?.length || 0,
    }, '[DirectQuery] 直连请求开始');

    // 上下文重建 + 本轮用户 content（existingEntries 来自守卫阶段，无二次读；
    // 兜底 filter 确保仅 direct 条目进上下文）
    const contextEntries = existingEntries.filter(e => e.provider === 'direct');

    const messages = buildMessagesFromEntries(contextEntries);
    const userContent = await buildDirectUserContent(userId, attachments, command, { projectName });
    messages.push({ role: 'user', content: userContent });

    // 受限工具回路：转发与 claude-response 内层同构的增量事件；
    // 模型调用 write_generated_doc 时执行写入并回填 tool_result，最多 3 轮
    const { hops } = await runDirectConversation({
      config,
      model,
      messages,
      maxTokens: DIRECT_MAX_TOKENS,
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
      // 双路径渲染修复：每跳流结束补发完整 assistant 消息（前端 onAddMessage 落消息列表）
      onAssistant: (contentBlocks) => {
        send(writer, {
          type: 'direct-response', sessionId,
          data: { type: 'assistant', content: contentBlocks },
        });
      },
      onToolResult: (toolUse, result) => {
        send(writer, { type: 'direct-tool-result', sessionId, data: { tool: toolUse.name, ...result } });
      },
      execTool: async (toolUse) => {
        if (toolUse.name !== WRITE_GENERATED_DOC_TOOL.name) {
          return { ok: false, error: `未知工具：${toolUse.name}` };
        }
        const result = await writeGeneratedDoc(userId, projectName, toolUse.input);
        if (result.ok) notifyDocCreatedAndRecord(userId, projectName, sessionId, toolUse, result, writer);
        return result;
      },
    });

    // 落盘本轮条目链：user → [assistant(+tool_use) + user(tool_result)]×轮 → assistant（中断不落盘——中断走 catch 分支）
    // 守卫命中时 sessionId 已是新 ID、contextEntries 为空 → parentUuid=null 独立成会
    const newEntries = [];
    const userEntry = buildUserEntry({
      sessionId,
      parentUuid: getLastEntryUuid(contextEntries),
      content: userContent,
      projectName,
    });
    newEntries.push(userEntry);
    let parentUuid = userEntry.uuid;
    for (const hop of hops) {
      if (hop.contentBlocks.length === 0) continue;
      const assistantEntry = buildAssistantEntry({
        sessionId,
        parentUuid,
        contentBlocks: hop.contentBlocks,
        model,
        usage: hop.usage,
        projectName,
      });
      newEntries.push(assistantEntry);
      parentUuid = assistantEntry.uuid;
      if (hop.toolResults.length > 0) {
        const toolUserEntry = buildUserEntry({
          sessionId,
          parentUuid,
          content: hop.toolResults.map(({ toolUseId, result }) => ({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify(result),
          })),
          projectName,
        });
        newEntries.push(toolUserEntry);
        parentUuid = toolUserEntry.uuid;
      }
    }
    await appendDirectTurn(userId, projectName, sessionId, newEntries);

    // durationMs：本轮整段耗时（请求开始→落盘完成），与下方完成日志同口径；前端在助手消息旁展示
    send(writer, { type: 'direct-complete', sessionId, provider: 'direct', exitCode: 0, durationMs: Date.now() - Date.parse(startedAt) });
    logger.info({
      sessionId,
      durationMs: Date.now() - Date.parse(startedAt),
      hops: hops.length,
      toolRounds: hops.filter(h => h.toolResults.length > 0).length,
    }, '[DirectQuery] 直连请求完成');
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
