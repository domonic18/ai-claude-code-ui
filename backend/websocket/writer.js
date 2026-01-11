/**
 * WebSocket 写入器模块
 *
 * 提供一个 WebSocket 包装类，匹配 SSEStreamWriter
 * 接口，以便在不同传输类型间实现一致的数据流传输。
 *
 * @module websocket/writer
 */

/**
 * WebSocket 写入器 - WebSocket 的包装器，用于匹配 SSEStreamWriter 接口
 * 由 AI 提供商用于发送流式响应
 */
export class WebSocketWriter {
    /**
     * 创建新的 WebSocket 写入器
     * @param {WebSocket} ws - 要包装的 WebSocket 连接
     */
    constructor(ws) {
        this.ws = ws;
        this.sessionId = null;
        this.isWebSocketWriter = true;  // 传输检测标记
    }

    /**
     * 通过 WebSocket 发送数据
     * @param {Object} data - 要发送的数据对象（将被 JSON 序列化）
     */
    send(data) {
        if (this.ws.readyState === 1) { // WebSocket.OPEN
            // 提供商发送原始对象，我们将其序列化为 WebSocket 格式
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * 设置此写入器的会话 ID
     * @param {string} sessionId - 会话标识符
     */
    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    /**
     * 获取当前会话 ID
     * @returns {string|null} 会话 ID，如果未设置则返回 null
     */
    getSessionId() {
        return this.sessionId;
    }
}
