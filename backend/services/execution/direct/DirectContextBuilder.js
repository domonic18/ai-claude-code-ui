/**
 * DirectContextBuilder.js
 *
 * 直连上下文重建：读容器 jsonl 条目 → /v1/messages 的 messages 数组。
 * 近零转换（jsonl message.content 与请求 content blocks 同构），
 * 唯一过滤是剔除 thinking 块（回传须带配对 signature，兼容层大概率拒收）。
 *
 * 纯函数模块，无 IO——IO 在 DirectSessionWriter.readDirectSessionEntries。
 *
 * @module services/execution/direct/DirectContextBuilder
 */

/** 上下文重建默认保留的最大消息条数 */
export const DEFAULT_MAX_MESSAGES = 40;

/**
 * 单条 content 转换：string 原样；数组仅保留 text/image 块（深拷贝防污染 jsonl 原条目）
 * @param {string|Array} content - 条目 message.content
 * @returns {string|Array|null} 转换后 content；无有效内容返回 null
 */
function convertContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;

  const blocks = content
    .filter(b => b && (b.type === 'text' || b.type === 'image'))
    .map(b => structuredClone(b));
  return blocks.length > 0 ? blocks : null;
}

/**
 * jsonl 条目数组 → /v1/messages messages 数组
 *
 * 规则：
 * 1. 仅取 message.role ∈ {user, assistant} 且非 API 错误条目
 *    （summary/result 条目无 message.role，天然排除）
 * 2. content 近零转换（剔 thinking 块）
 * 3. 连续同 role 条目合并（Messages API 要求交替）
 * 4. 尾部 maxMessages 条截断；截断后首条非 user 则丢弃（首条必须是 user）
 *
 * @param {Array} entries - jsonl 条目数组（readDirectSessionEntries 返回值）
 * @param {Object} [options]
 * @param {number} [options.maxMessages=40] - 最大消息条数
 * @returns {Array<{role: string, content: string|Array}>} messages 数组
 */
export function buildMessagesFromEntries(entries, { maxMessages = DEFAULT_MAX_MESSAGES } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const messages = [];
  for (const entry of entries) {
    const role = entry?.message?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    if (entry.isApiErrorMessage === true) continue;

    const content = convertContent(entry.message.content);
    if (content === null) continue;

    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      // 防御性合并：连续同 role（异常 jsonl 或厂商乱序）拼 content
      last.content = Array.isArray(last.content) || Array.isArray(content)
        ? toArrayContent(last.content).concat(toArrayContent(content))
        : `${last.content}\n${content}`;
    } else {
      messages.push({ role, content });
    }
  }

  if (messages.length > maxMessages) {
    messages.splice(0, messages.length - maxMessages);
    // 截断后首条必须是 user（Messages API 约束）；仅在发生过截断时修正
    while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  }

  return messages;
}

/**
 * content 统一转数组形态（合并同 role 时用）
 * @param {string|Array} content
 * @returns {Array} content blocks 数组
 */
function toArrayContent(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return Array.isArray(content) ? content : [];
}
