/**
 * Agent 响应写入器
 *
 * 提供 SSE 流式和非流式两种响应收集适配器，
 * 将 SDK/CLI 输出统一适配到 HTTP 响应。
 *
 * @module services/execution/AgentWriter
 */

/**
 * SSE 流写入器 - 将 SDK/CLI 输出适配到 Server-Sent Events
 */
export class SSEStreamWriter {
    /**
     * @param {import('http').ServerResponse} res - Express 响应对象
     */
    constructor(res) {
        this.res = res;
        this.sessionId = null;
        this.isSSEStreamWriter = true;
    }

    /**
     * 发送 SSE 数据事件
     * @param {Object} data - 要发送的数据对象
     */
    send(data) {
        if (this.res.writableEnded) return;
        this.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    /**
     * 发送 done 事件并关闭流
     */
    end() {
        if (!this.res.writableEnded) {
            this.res.write('data: {"type":"done"}\n\n');
            this.res.end();
        }
    }

    /** @param {string} sessionId */
    setSessionId(sessionId) { this.sessionId = sessionId; }

    /** @returns {string|null} */
    getSessionId() { return this.sessionId; }
}

/**
 * 非流式响应收集器 - 收集所有消息后一次性返回
 */
export class ResponseCollector {
    constructor() {
        /** @type {Array<Object>} */
        this.messages = [];
        this.sessionId = null;
    }

    /**
     * 收集一条消息
     * @param {Object|string} data - 消息数据
     */
    send(data) {
        this.messages.push(data);

        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed.sessionId) this.sessionId = parsed.sessionId;
            } catch { /* not JSON */ }
        } else if (data && data.sessionId) {
            this.sessionId = data.sessionId;
        }
    }

    /** 无操作 */
    end() {}

    /** @param {string} sessionId */
    setSessionId(sessionId) { this.sessionId = sessionId; }

    /** @returns {string|null} */
    getSessionId() { return this.sessionId; }

    /** @returns {Array<Object>} */
    getMessages() { return this.messages; }

    /**
     * 获取过滤后的助手消息
     * @returns {Array<Object>}
     */
    getAssistantMessages() {
        const result = [];
        for (const msg of this.messages) {
            if (msg && msg.type === 'status') continue;

            if (typeof msg === 'string') {
                try {
                    const parsed = JSON.parse(msg);
                    if (parsed.type === 'claude-response' && parsed.data && parsed.data.type === 'assistant') {
                        result.push(parsed.data);
                    }
                } catch { /* skip */ }
            }
        }
        return result;
    }

    /**
     * 计算所有消息的令牌使用总量
     * @returns {{inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheCreationTokens: number, totalTokens: number}}
     */
    getTotalTokens() {
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheReadTokens = 0;
        let cacheCreationTokens = 0;

        for (const msg of this.messages) {
            let data = msg;
            if (typeof msg === 'string') {
                try { data = JSON.parse(msg); } catch { continue; }
            }

            if (data && data.type === 'claude-response' && data.data) {
                const usage = data.data.message?.usage;
                if (usage) {
                    inputTokens += usage.input_tokens || 0;
                    outputTokens += usage.output_tokens || 0;
                    cacheReadTokens += usage.cache_read_input_tokens || 0;
                    cacheCreationTokens += usage.cache_creation_input_tokens || 0;
                }
            }
        }

        return {
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens
        };
    }
}
