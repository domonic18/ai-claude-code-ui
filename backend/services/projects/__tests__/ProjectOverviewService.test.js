/**
 * ProjectOverviewService.test.js
 *
 * 案件概览服务纯函数单元测试
 * 覆盖：extractTranscript（JSONL → transcript 拼接）、cleanOverviewContent（去 frontmatter）
 *
 * 运行：npm run test:services（或 ./scripts/run-node-test.sh 本文件）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTranscript, cleanOverviewContent } from '../ProjectOverviewService.js';

describe('extractTranscript', () => {
  it('应从 user/assistant 消息按顺序拼接 transcript', () => {
    const jsonl = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: '你好' } }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: '你好，有什么可以帮你？' } }),
    ].join('\n');
    assert.equal(
      extractTranscript(jsonl),
      '用户: 你好\n\nAI: 你好，有什么可以帮你？',
    );
  });

  it('空 / null / undefined 输入返回空字符串', () => {
    assert.equal(extractTranscript(''), '');
    assert.equal(extractTranscript(null), '');
    assert.equal(extractTranscript(undefined), '');
  });

  it('跳过非 user/assistant 消息（system / tool 等）', () => {
    const jsonl = [
      JSON.stringify({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' }),
      JSON.stringify({ type: 'tool_use', name: 'Read' }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: '用户消息' } }),
    ].join('\n');
    assert.equal(extractTranscript(jsonl), '用户: 用户消息');
  });

  it('content 为数组时取各段 text 拼接（推理模型格式）', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', text: '思考内容' },
          { type: 'text', text: '回复正文' },
        ],
      },
    });
    assert.equal(extractTranscript(jsonl), 'AI: 思考内容 回复正文');
  });

  it('跳过无效 JSON 行（不影响有效行）', () => {
    const jsonl = [
      '这不是 JSON',
      JSON.stringify({ type: 'user', message: { role: 'user', content: '有效消息' } }),
    ].join('\n');
    assert.equal(extractTranscript(jsonl), '用户: 有效消息');
  });

  it('无 user/assistant 消息返回空', () => {
    const jsonl = JSON.stringify({ type: 'system', content: 'x' });
    assert.equal(extractTranscript(jsonl), '');
  });

  it('空 content 的消息跳过', () => {
    const jsonl = JSON.stringify({ type: 'user', message: { role: 'user', content: '' } });
    assert.equal(extractTranscript(jsonl), '');
  });

  it('多轮对话保持顺序与分隔', () => {
    const jsonl = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: '第一问' } }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: '第一答' } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: '第二问' } }),
    ].join('\n');
    assert.equal(
      extractTranscript(jsonl),
      '用户: 第一问\n\nAI: 第一答\n\n用户: 第二问',
    );
  });
});

describe('cleanOverviewContent', () => {
  it('去除 frontmatter 返回正文', () => {
    const raw = [
      '---',
      'session_id: abc-123',
      'project: 我的案件',
      'generated_at: 2026-07-22T00:00:00.000Z',
      '---',
      '',
      '这是摘要正文。',
      '包含多行。',
    ].join('\n');
    assert.equal(cleanOverviewContent(raw), '这是摘要正文。\n包含多行。');
  });

  it('无 frontmatter 时原样返回（trim 首尾空白）', () => {
    assert.equal(cleanOverviewContent('  直接是正文  '), '直接是正文');
  });

  it('空 / null / undefined 返回空', () => {
    assert.equal(cleanOverviewContent(''), '');
    assert.equal(cleanOverviewContent(null), '');
    assert.equal(cleanOverviewContent(undefined), '');
  });

  it('只保留正文，去掉 frontmatter 的所有元数据', () => {
    const raw = '---\nsession_id: x\nproject: y\n---\n\n摘要内容';
    const result = cleanOverviewContent(raw);
    assert.equal(result, '摘要内容');
    assert.ok(!result.includes('session_id'));
    assert.ok(!result.includes('project: y'));
  });
});
