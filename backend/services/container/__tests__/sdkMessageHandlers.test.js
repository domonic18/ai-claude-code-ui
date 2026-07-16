/**
 * sdkMessageHandlers 接口测试
 *
 * 验证输出尺寸埋点的数据管线（最易出 bug、最该测的部分）：
 *   流式 delta（text / thinking / partial_json）
 *     → handleStreamEvent 累积到 state.curTurnStats（textChars/thinkChars/toolUseChars/count）
 *     → 这些字段正是 [API #seq] 载荷 outputChars/textChars/toolUseChars 的来源
 *
 * 设计说明（诚实边界）：
 * - 本 Node 版本（v22.23.1）不支持 mock.module（无 --experimental-test-module-mock），
 *   无法拦截模块顶层 createLogger 去 capture logger.info 载荷。
 * - 故不测「载荷里 outputChars 的值」，而测它的【数据源】curTurnStats 是否正确累积；
 *   outputChars = thinkChars+textChars+toolUseChars 是 sdkMessageHandlers.js 中的 3 行直赋值，
 *   其正确性由：① 本测试证明数据源 ② node --check ③ 生产 genRateCps（同 totalChars）已验证 三重保证。
 * - 另加 handleAssistantMessage 冒烟测试：确保带 curTurnStats 收尾时不抛错、清空状态、触发 writer.send，
 *   即【outputChars 赋值那几行确实被执行了】。
 *
 * @module services/container/__tests__/sdkMessageHandlers.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleStreamEvent, handleAssistantMessage } from '../claude/sdkMessageHandlers.js';

/** 全新 state（结构对齐 handleStreamEvent / handleAssistantMessage 读取的字段） */
function makeState(over = {}) {
  return {
    apiCallSeq: 0,
    toolSeq: 0,
    toolTimers: new Map(),
    toolNames: new Map(),
    lastEventTime: null,
    lastDeltaTime: null,
    turnStartTime: null,
    turnDeltaCount: 0,
    curTurnStats: null,
    ...over,
  };
}

/** 记录 send 的 mock writer */
function makeWriter() {
  const sent = [];
  return { sent, writer: { send: (m) => sent.push(m) } };
}

describe('handleStreamEvent — delta 累积 curTurnStats（outputChars 的数据源）', () => {

  it('message_start 置 turnStartTime 并清零 turnDeltaCount', () => {
    const { writer } = makeWriter();
    const s = makeState({ turnDeltaCount: 99 });
    handleStreamEvent({ type: 'message_start' }, writer, s);
    assert.ok(s.turnStartTime !== null);
    assert.equal(s.turnDeltaCount, 0);
  });

  it('text/thinking/partial_json 三类 delta 各自累积字符 + count', () => {
    const { writer } = makeWriter();
    const s = makeState();
    handleStreamEvent({ type: 'message_start' }, writer, s);
    handleStreamEvent({ type: 'content_block_delta', delta: { text: 'hello ' } }, writer, s);
    handleStreamEvent({ type: 'content_block_delta', delta: { text: 'world' } }, writer, s);
    handleStreamEvent({ type: 'content_block_delta', delta: { thinking: '推理' } }, writer, s);
    handleStreamEvent({ type: 'content_block_delta', delta: { partial_json: '{"new_string":"章节正文"' } }, writer, s);

    const ts = s.curTurnStats;
    assert.ok(ts, 'curTurnStats 应已创建');
    assert.equal(ts.textChars, 11, "text: 'hello '+'world' = 11");
    assert.equal(ts.thinkChars, 2, "thinking: '推理' = 2");
    assert.equal(ts.toolUseChars, '{"new_string":"章节正文"'.length, 'partial_json 完整长度');
    assert.equal(ts.count, 4, '4 个 delta');
    assert.ok(ts.firstTime !== null && ts.lastTime !== null, '首/末片时间戳已记');
  });

  it('partial_json 累积——tool_use 轮也能得到 toolUseChars（历史 bug 回归）', () => {
    // 历史问题：tool_use 轮的 input_json_delta 未累积 → 该轮 genMs/outputChars 缺失
    const { writer } = makeWriter();
    const s = makeState();
    handleStreamEvent({ type: 'message_start' }, writer, s);
    handleStreamEvent({ type: 'content_block_delta', delta: { partial_json: 'x'.repeat(3000) } }, writer, s);
    assert.equal(s.curTurnStats.toolUseChars, 3000);
    assert.equal(s.curTurnStats.count, 1);
  });
});

describe('handleAssistantMessage — 收尾冒烟（执行 outputChars 赋值路径，不抛错）', () => {

  it('带 curTurnStats 收尾：不抛错、清空 curTurnStats、触发 writer.send', () => {
    const { writer, sent } = makeWriter();
    const s = makeState({
      curTurnStats: {
        firstTime: 1_000, firstSinceLast: 500, lastTime: 3_000,
        thinkChars: 100, textChars: 200, toolUseChars: 300, count: 9,
      },
    });
    const sdkMessage = {
      type: 'assistant',
      message: {
        usage: { input_tokens: 50_000, output_tokens: 600 },
        content: [{ type: 'text', text: '完成' }],
      },
    };

    // 关键：这一步会执行 logPayload.outputChars = totalChars 等赋值（line 145-147）。
    // 若该路径有运行期错误（如 totalChars 未定义），此处会抛出 → 测试失败。
    // 注意签名 (sdkMessage, writer, sessionId, state) —— state 是第 4 参，少传会被当 sessionId。
    assert.doesNotThrow(() => handleAssistantMessage(sdkMessage, writer, 'sess-1', s));

    assert.equal(s.curTurnStats, null, '收尾后 curTurnStats 必须清空（防下轮串数据）');
    assert.ok(sent.length > 0, '应通过 writer.send 转发 claude-response');
  });

  it('无 curTurnStats 收尾：跳过 output 赋值分支，不崩溃', () => {
    const { writer, sent } = makeWriter();
    const s = makeState(); // curTurnStats = null
    const sdkMessage = {
      type: 'assistant',
      message: { usage: {}, content: [{ type: 'text', text: 'hi' }] },
    };

    assert.doesNotThrow(() => handleAssistantMessage(sdkMessage, writer, 'sess-2', s));
    assert.ok(sent.length > 0);
  });
});
