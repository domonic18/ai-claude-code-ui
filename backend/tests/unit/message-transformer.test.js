/**
 * MessageTransformer 行为测试
 *
 * 核心回归保护：agent-question-auto-answered 的 reason 闸门——
 * 交互模式 AFK 超时自动采用（reason:'afk_timeout'）必须转发前端渲染卡片终态；
 * bypassPermissions 模式（无 reason）保持仅日志不转发。
 *
 * @module tests/unit/message-transformer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { processOutputLine } from '../../services/container/claude/MessageTransformer.js';

/**
 * 构造 fake writer + state，处理一行容器 stdout
 * @param {string} line - 容器 stdout JSON 行
 * @param {object} [stateOverrides] - 覆盖 state（默认带 realSessionId）
 * @returns {{sent: object[], state: object}} writer 发出的 WS 消息列表
 */
function processLine(line, stateOverrides = {}) {
  const sent = [];
  const writer = { send: (msg) => sent.push(msg) };
  const state = { realSessionId: 'real-session-1', ...stateOverrides };
  processOutputLine(line, writer, 'alias-session-1', state);
  return { sent, state };
}

describe('MessageTransformer - agent-question-auto-answered 闸门', () => {
  it('reason:afk_timeout（交互模式超时自动采用）转发前端', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-question-auto-answered',
      reason: 'afk_timeout',
      toolUseID: 'tu_1',
      answers: { '整体策略?': '授权优先版（推荐）' }
    }));

    assert.strictEqual(sent.length, 1);
    const msg = sent[0];
    assert.strictEqual(msg.type, 'agent-question-auto-answered');
    // sessionId 必须用真实会话 ID（前端按会话过滤并定位卡片）
    assert.strictEqual(msg.sessionId, 'real-session-1');
    assert.strictEqual(msg.data.toolUseID, 'tu_1');
    assert.deepStrictEqual(msg.data.answers, { '整体策略?': '授权优先版（推荐）' });
    assert.strictEqual(msg.data.reason, 'afk_timeout');
  });

  it('text 降级通道（response 字段）同样转发', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-question-auto-answered',
      reason: 'afk_timeout',
      toolUseID: 'tu_2',
      response: '继续'
    }));

    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].data.response, '继续');
    assert.deepStrictEqual(sent[0].data.answers, {});
  });

  it('无 reason（bypassPermissions 模式）不转发，保持仅日志', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-question-auto-answered',
      toolUseID: 'tu_3',
      autoAnswer: '继续'
    }));

    assert.strictEqual(sent.length, 0, 'bypass 模式不应转发前端');
  });

  it('realSessionId 缺失时回退别名 sessionId', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-question-auto-answered',
      reason: 'afk_timeout',
      toolUseID: 'tu_4',
      answers: { 'q?': 'A' }
    }), { realSessionId: undefined });

    assert.strictEqual(sent[0].sessionId, 'alias-session-1');
  });
});

describe('MessageTransformer - 原有消息类型不回归', () => {
  it('agent-question 透传 questions/prompt/timeoutMs', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-question',
      toolUseID: 'tu_q',
      questions: [{ question: '整体策略?', options: [{ label: 'A（推荐）' }] }],
      prompt: '请选择',
      timeoutMs: 300000
    }));

    assert.strictEqual(sent.length, 1);
    const msg = sent[0];
    assert.strictEqual(msg.type, 'agent-question');
    assert.strictEqual(msg.data.toolUseID, 'tu_q');
    assert.strictEqual(msg.data.timeoutMs, 300000);
    assert.strictEqual(msg.data.questions.length, 1);
  });

  it('agent-answer-dropped 继续转发（失效回答提示）', () => {
    const { sent } = processLine(JSON.stringify({
      type: 'agent-answer-dropped',
      toolUseID: 'tu_dead',
      reason: 'no_active_ask'
    }));

    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'agent-answer-dropped');
    assert.strictEqual(sent[0].data.reason, 'no_active_ask');
  });
});
