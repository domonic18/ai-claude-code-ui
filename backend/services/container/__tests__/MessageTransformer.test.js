/**
 * MessageTransformer Unit Tests
 *
 * 重点验证 processOutput 的行缓冲：Docker exec 流不保证一行 JSON 在单个
 * `data` 事件里完整到达，大体积 SDK 消息（长文档 Write/Edit，单行数十 KB）
 * 会被切成多个 `data` 事件。必须跨调用累积完整行再解析，否则残缺 JSON 被
 * tryParseJSON 静默丢弃，导致工具调用（及文档追踪/摘要）整体丢失。
 *
 * @module services/container/__tests__/MessageTransformer.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processOutput } from '../claude/MessageTransformer.js';

/** 构造记录 send 的 mock writer 与全新 state（结构对齐 handleStreamProcessing） */
function makeHarness() {
  const sent = [];
  return {
    sent,
    writer: { send: (msg) => sent.push(msg) },
    state: { sessionCreatedSent: false, toolSeq: 0, toolTimers: new Map() },
  };
}

/**
 * 构造一条大体积 content 消息（chunk.type 非 assistant/result，
 * 走 handleDefaultMessage，避免触发文档追踪等 Docker 副作用）。
 */
function makeBigLine(payloadSize) {
  const chunk = { type: 'system', data: 'X'.repeat(payloadSize) };
  return JSON.stringify({ type: 'content', chunk }) + '\n';
}

describe('processOutput 行缓冲', () => {
  it('大行被切成多段 data 事件后，仍能完整解析（核心回归）', () => {
    const { sent, writer, state } = makeHarness();
    const line = makeBigLine(40_000);

    // 模拟 Docker 流把同一行切成 3 段到达（每段都落在行中间，无 \n）
    processOutput(line.slice(0, 15_000), writer, 's1', state);
    assert.equal(sent.length, 0, '首段不完整，不应解析出消息');
    assert.ok(state.stdoutBuffer.length > 0, '不完整尾巴应保留在缓冲');

    processOutput(line.slice(15_000, 30_000), writer, 's1', state);
    assert.equal(sent.length, 0, '中段仍不完整，不应解析出消息');

    processOutput(line.slice(30_000), writer, 's1', state);
    assert.equal(sent.length, 1, '拼出完整行后应解析出 1 条消息');

    // 解析出的 chunk 与原始完全一致 → 证明未被截断/丢失
    assert.deepEqual(sent[0].data, JSON.parse(line).chunk);
    assert.equal(state.stdoutBuffer, '', '完整行解析后缓冲应清空');
  });

  it('整行一次到达（无分片）：正常解析', () => {
    const { sent, writer, state } = makeHarness();
    processOutput(makeBigLine(100), writer, 's1', state);
    assert.equal(sent.length, 1);
    assert.equal(state.stdoutBuffer, '');
  });

  it('一个 data 事件含多行：逐行解析', () => {
    const { sent, writer, state } = makeHarness();
    processOutput(makeBigLine(10) + makeBigLine(20), writer, 's1', state);
    assert.equal(sent.length, 2);
  });

  it('不完整尾巴跨 data 事件保留，不产生误解析', () => {
    const { sent, writer, state } = makeHarness();
    const line = makeBigLine(5_000);
    const newlineIdx = line.indexOf('\n');

    processOutput(line.slice(0, newlineIdx), writer, 's1', state); // 整段 JSON，无 \n
    assert.equal(sent.length, 0);
    assert.ok(state.stdoutBuffer.length > 0);

    processOutput(line.slice(newlineIdx), writer, 's1', state); // 补齐 \n
    assert.equal(sent.length, 1);
  });
});
