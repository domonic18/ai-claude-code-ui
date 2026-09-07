/**
 * DirectModelClient.test.js
 *
 * 直连模型客户端纯函数单元测试（SSE 解析 / 流累积器 / 请求头）。
 * streamDirectMessage 涉及真实网络 IO，留集成验收（方案第七节实测清单）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSSEBuffer,
  createStreamAccumulator,
  buildDirectHeaders,
} from '../DirectModelClient.js';

describe('parseSSEBuffer', () => {
  it('should parse a single complete event', () => {
    const buffer = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"你好"}}\n\n';
    const { events, rest } = parseSSEBuffer(buffer);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'content_block_delta');
    assert.equal(events[0].delta.text, '你好');
    assert.equal(rest, '');
  });

  it('should parse multiple events in one buffer', () => {
    const buffer = 'data: {"type":"message_start"}\n\ndata: {"type":"content_block_delta","delta":{"text":"a"}}\n\n';
    const { events } = parseSSEBuffer(buffer);
    assert.equal(events.length, 2);
    assert.equal(events[1].delta.text, 'a');
  });

  it('should keep incomplete trailing event in rest (cross-chunk)', () => {
    const buffer = 'data: {"type":"content_block_delta","delta":{"text":"a"}}\n\ndata: {"type":"mess';
    const { events, rest } = parseSSEBuffer(buffer);
    assert.equal(events.length, 1);
    assert.equal(rest, 'data: {"type":"mess');
  });

  it('should resume parsing from carried rest', () => {
    const rest1 = 'data: {"type":"mess';
    const chunk2 = 'age_stop"}\n\n';
    const { events } = parseSSEBuffer(rest1 + chunk2);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'message_stop');
  });

  it('should tolerate CRLF line endings', () => {
    const buffer = 'data: {"type":"ping"}\r\n\r\n';
    const { events } = parseSSEBuffer(buffer);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'ping');
  });

  it('should drop non-JSON data lines', () => {
    const buffer = 'data: [DONE]\n\ndata: {"type":"message_stop"}\n\n';
    const { events } = parseSSEBuffer(buffer);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'message_stop');
  });

  it('should join multi-line data payloads', () => {
    const buffer = 'data: {"type":"a",\ndata: "x":1}\n\n';
    const { events } = parseSSEBuffer(buffer);
    assert.equal(events.length, 1);
    assert.equal(events[0].x, 1);
  });

  it('should return empty for empty buffer', () => {
    const { events, rest } = parseSSEBuffer('');
    assert.equal(events.length, 0);
    assert.equal(rest, '');
  });
});

describe('createStreamAccumulator', () => {
  it('should accumulate text deltas into a text block', () => {
    const acc = createStreamAccumulator();
    acc.onEvent({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    acc.onEvent({ type: 'content_block_delta', index: 0, delta: { text: '你' } });
    acc.onEvent({ type: 'content_block_delta', index: 0, delta: { text: '好' } });

    const result = acc.getResult();
    assert.equal(result.contentBlocks.length, 1);
    assert.deepEqual(result.contentBlocks[0], { type: 'text', text: '你好' });
  });

  it('should accumulate thinking deltas separately', () => {
    const acc = createStreamAccumulator();
    acc.onEvent({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } });
    acc.onEvent({ type: 'content_block_delta', index: 0, delta: { thinking: '推理' } });
    acc.onEvent({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } });
    acc.onEvent({ type: 'content_block_delta', index: 1, delta: { text: '答案' } });

    const result = acc.getResult();
    assert.equal(result.contentBlocks.length, 2);
    assert.deepEqual(result.contentBlocks[0], { type: 'thinking', thinking: '推理' });
    assert.deepEqual(result.contentBlocks[1], { type: 'text', text: '答案' });
  });

  it('should ignore deltas for unknown block index', () => {
    const acc = createStreamAccumulator();
    acc.onEvent({ type: 'content_block_delta', index: 5, delta: { text: '孤儿' } });
    assert.equal(acc.getResult().contentBlocks.length, 0);
  });

  it('should merge usage from message_start and message_delta', () => {
    const acc = createStreamAccumulator();
    acc.onEvent({
      type: 'message_start',
      message: { usage: { input_tokens: 100, cache_read_input_tokens: 40, cache_creation_input_tokens: 10 } },
    });
    acc.onEvent({ type: 'message_delta', usage: { output_tokens: 60 }, delta: { stop_reason: 'end_turn' } });

    const result = acc.getResult();
    assert.deepEqual(result.usage, {
      input_tokens: 100,
      output_tokens: 60,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 40,
    });
    assert.equal(result.stopReason, 'end_turn');
  });

  it('should return zeroed usage for empty stream', () => {
    const acc = createStreamAccumulator();
    const result = acc.getResult();
    assert.deepEqual(result.usage, {
      input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    });
    assert.equal(result.stopReason, null);
  });
});

describe('buildDirectHeaders', () => {
  it('should build headers with authToken as Bearer', () => {
    const headers = buildDirectHeaders({ authToken: 'tok-1' });
    assert.equal(headers.Authorization, 'Bearer tok-1');
    assert.equal(headers['x-api-key'], undefined);
    assert.equal(headers['anthropic-version'], '2023-06-01');
  });

  it('should build headers with apiKey as x-api-key', () => {
    const headers = buildDirectHeaders({ apiKey: 'key-1' });
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers['x-api-key'], 'key-1');
  });

  it('should send both when both provided', () => {
    const headers = buildDirectHeaders({ authToken: 'tok-1', apiKey: 'key-1' });
    assert.equal(headers.Authorization, 'Bearer tok-1');
    assert.equal(headers['x-api-key'], 'key-1');
  });

  it('should always include content type and anthropic version', () => {
    const headers = buildDirectHeaders({});
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers['anthropic-version'], '2023-06-01');
  });
});
