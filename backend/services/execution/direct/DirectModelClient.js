/**
 * DirectModelClient.js
 *
 * 直连模型唯一 API 调用点：fetch 厂商 Anthropic 兼容端点 /v1/messages（SSE 流式）。
 * 所有 fetch 细节（URL 拼接、认证头、SSE 解析、超时、中止）收敛在本模块，业务层不接触。
 *
 * 纯函数（parseSSEBuffer / createStreamAccumulator / buildDirectHeaders）可独立单测；
 * streamDirectMessage 是唯一 IO 函数。
 *
 * @module services/execution/direct/DirectModelClient
 */

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/direct/DirectModelClient');

/** 首 token 超时（毫秒）：连接建立后迟迟无首个有效事件则中止 */
export const FIRST_TOKEN_TIMEOUT_MS = 30_000;

/** 单轮请求总超时（毫秒）：兜底防长流悬挂烧 token */
export const TOTAL_TIMEOUT_MS = 600_000;

/** SSE 事件负载上限（字符）：防御异常响应行撑爆内存 */
const MAX_SSE_DATA_LENGTH = 2 * 1024 * 1024;

/**
 * SSE 接收缓冲上限（字符）：未形成完整事件（无空行边界）的残片缓冲兜底。
 * MAX_SSE_DATA_LENGTH 只限制完整事件的载荷，异常端点持续推送无边界的文本时
 * 残片会无限累积，此处超限即中止，防止单个异常 baseURL 撑爆后端进程内存。
 */
export const MAX_SSE_BUFFER_LENGTH = 8 * 1024 * 1024;

/**
 * 解析 SSE 接收缓冲区，取出完整事件的 data 载荷
 *
 * 规则：按 \n 分行（容忍 \r\n），聚合连续 data: 行，空行界分事件；
 * 非 JSON 的 data 行丢弃（SSE 注释/心跳容错）；未以空行结尾的残片留在 rest 里等下个 chunk。
 *
 * @param {string} buffer - 累积的原始文本（可能含不完整尾部）
 * @returns {{ events: Object[], rest: string, sawData: boolean }} 已完成事件的对象数组、
 *   剩余缓冲、是否出现过完整 data 行（含被丢弃的非 JSON/超限行——首 token 判定依据，
 *   心跳等非 JSON 事件同样证明连接与服务端活跃）
 */
export function parseSSEBuffer(buffer) {
  const events = [];
  let sawData = false;
  const normalized = buffer.replace(/\r\n/g, '\n');
  // 以空行分界切事件块；最后一块若非空行结尾则是不完整事件，留在 rest
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';

  for (const block of blocks) {
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0) continue;
    sawData = true;
    const payload = dataLines.join('\n');
    if (!payload || payload.length > MAX_SSE_DATA_LENGTH) continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // 非 JSON data（如 "event: ping" 类注释流）忽略
    }
  }
  return { events, rest, sawData };
}

/**
 * 创建流事件累积器：把 Anthropic SSE 事件流聚合成最终消息
 *
 * 处理 content_block_start/delta/message_start/message_delta，
 * 产出与 jsonl assistant 条目 message.content 同构的 blocks 数组。
 *
 * @returns {{ onEvent: (event: Object) => void, getResult: () => DirectStreamResult }}
 */
export function createStreamAccumulator() {
  /** @type {Array<{type: string, text?: string, thinking?: string}>} */
  const contentBlocks = [];
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  let stopReason = null;

  return {
    onEvent(event) {
      if (!event || typeof event !== 'object') return;

      if (event.type === 'content_block_start' && event.content_block) {
        const block = event.content_block;
        if (block.type === 'text') contentBlocks.push({ type: 'text', text: '' });
        else if (block.type === 'thinking') contentBlocks.push({ type: 'thinking', thinking: '' });
        // tool_use 等块直连模式不会请求，忽略
      } else if (event.type === 'content_block_delta' && typeof event.index === 'number') {
        const block = contentBlocks[event.index];
        if (!block) return;
        if (typeof event.delta?.text === 'string') block.text += event.delta.text;
        else if (typeof event.delta?.thinking === 'string') block.thinking += event.delta.thinking;
      } else if (event.type === 'message_start') {
        // message_start 的 usage 只含 input 侧
        const u = event.message?.usage;
        if (u) {
          usage.input_tokens = u.input_tokens || 0;
          usage.cache_creation_input_tokens = u.cache_creation_input_tokens || 0;
          usage.cache_read_input_tokens = u.cache_read_input_tokens || 0;
        }
      } else if (event.type === 'message_delta') {
        if (typeof event.usage?.output_tokens === 'number') usage.output_tokens = event.usage.output_tokens;
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
      }
    },
    getResult() {
      return {
        contentBlocks,
        usage: { ...usage },
        stopReason,
      };
    },
  };
}

/**
 * 构造 /v1/messages 请求头
 *
 * authToken → Authorization: Bearer（对齐 SummaryService 先例）；
 * apiKey 存在时附加 x-api-key（部分兼容层只认其一，双有双发）。
 *
 * @param {Object} params
 * @param {string} [params.authToken] - Bearer 令牌
 * @param {string} [params.apiKey] - x-api-key 令牌
 * @returns {Object} fetch headers 对象
 */
export function buildDirectHeaders({ authToken, apiKey } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  return headers;
}

/**
 * 流式调用 /v1/messages
 *
 * @param {Object} config - 提供商配置（getModelProviderConfig 返回值）
 * @param {string} config.baseURL - 提供商基础 URL（末尾斜杠容忍）
 * @param {string} [config.authToken] - Bearer 令牌
 * @param {string} [config.apiKey] - x-api-key 令牌
 * @param {Object} request - 请求体
 * @param {string} request.model - 模型名
 * @param {Array} request.messages - Anthropic Messages 格式消息数组
 * @param {number} request.maxTokens - max_tokens
 * @param {string} [request.system] - 可选 system prompt（默认不传）
 * @param {Object} handlers
 * @param {(event: Object) => void} handlers.onEvent - 每个已解析 SSE 事件的回调
 * @param {AbortSignal} [handlers.signal] - 外部中止信号（用户停止）
 * @param {number} [handlers.firstTokenTimeoutMs] - 首 token 超时，默认 30s
 * @param {number} [handlers.totalTimeoutMs] - 总超时，默认 600s
 * @returns {Promise<DirectStreamResult>} 累积结果（contentBlocks/usage/stopReason）
 * @throws {Error} name='DirectTimeoutError' 超时；AbortError 用户中止；
 *   name='DirectProtocolError' SSE 流异常（接收缓冲超限）；其余为 HTTP/网络错误
 */
export async function streamDirectMessage(config, request, handlers = {}) {
  const {
    onEvent = () => {},
    signal,
    firstTokenTimeoutMs = FIRST_TOKEN_TIMEOUT_MS,
    totalTimeoutMs = TOTAL_TIMEOUT_MS,
  } = handlers;

  const baseURL = (config.baseURL || '').replace(/\/+$/, '');
  const url = `${baseURL}/v1/messages`;

  const body = {
    model: request.model,
    max_tokens: request.maxTokens,
    messages: request.messages,
    stream: true,
  };
  if (request.system) body.system = request.system;

  // 总超时与首 token 超时合成到一个 controller；signal 链接外部中止（用户停止）
  const timeoutController = new AbortController();
  const timeoutError = (msg) => {
    const err = new Error(msg);
    err.name = 'DirectTimeoutError';
    timeoutController.abort(err);
  };
  const onExternalAbort = () => timeoutController.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) timeoutController.abort(signal.reason);
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const totalTimer = setTimeout(
    () => timeoutError('DirectModelClient total timeout'),
    totalTimeoutMs,
  );
  // 首 token 超时：首个完整 data 行（含心跳等非 JSON 事件）到达前保持计时，到达即失效
  let gotFirstToken = false;
  const firstTokenTimer = setTimeout(() => {
    if (!gotFirstToken) timeoutError('DirectModelClient first token timeout');
  }, firstTokenTimeoutMs);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildDirectHeaders(config),
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      const errorText = (await response.text().catch(() => '')).slice(0, 500);
      throw Object.assign(new Error(`模型 API 返回 ${response.status}`), {
        status: response.status, errorText,
      });
    }

    const accumulator = createStreamAccumulator();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let rest = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rest += decoder.decode(value, { stream: true });
        const parsed = parseSSEBuffer(rest);
        rest = parsed.rest;

        if (rest.length > MAX_SSE_BUFFER_LENGTH) {
          throw Object.assign(
            new Error(`模型端点 SSE 流异常：接收缓冲超过 ${MAX_SSE_BUFFER_LENGTH} 字符（疑似无事件边界的异常响应）`),
            { name: 'DirectProtocolError' },
          );
        }

        if (parsed.sawData) gotFirstToken = true;

        for (const event of parsed.events) {
          accumulator.onEvent(event);
          onEvent(event);
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const result = accumulator.getResult();
    logger.info({
      durationMs: Date.now() - startedAt,
      blocks: result.contentBlocks.length,
      outputTokens: result.usage.output_tokens,
      stopReason: result.stopReason,
    }, '[DirectModelClient] 流式调用完成');
    return result;
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) throw err;
    if (err?.name === 'DirectTimeoutError') throw err;
    logger.error({ err, model: request.model, status: err?.status }, '[DirectModelClient] 流式调用失败');
    throw err;
  } finally {
    clearTimeout(totalTimer);
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * @typedef {Object} DirectStreamResult
 * @property {Array<{type: string, text?: string, thinking?: string}>} contentBlocks
 * @property {{input_tokens: number, output_tokens: number, cache_creation_input_tokens: number, cache_read_input_tokens: number}} usage
 * @property {string|null} stopReason
 */
