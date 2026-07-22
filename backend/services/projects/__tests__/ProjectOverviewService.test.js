/**
 * ProjectOverviewService.test.js
 *
 * 案件概览服务单元测试
 * 覆盖：extractTranscript、cleanOverviewContent（纯函数）
 *       readAllForInjection（class 方法，stub list/read）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTranscript, cleanOverviewContent, ProjectOverviewService } from '../ProjectOverviewService.js';

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

describe('readAllForInjection', () => {
  // 辅助：构造 stub 实例（覆写依赖容器的 list/read 方法）
  const makeService = (list, read) => {
    const service = new ProjectOverviewService();
    service.listOverviews = list;
    service.readOverview = read;
    return service;
  };

  it('拼接所有会话摘要（含 sessionId）', async () => {
    const service = makeService(
      async () => [
        { sessionId: 's1', mtime: 1700000000000 },
        { sessionId: 's2', mtime: 1700000000001 },
      ],
      async (_u, _p, sid) => ({ content: `摘要-${sid}`, path: '' }),
    );
    const result = await service.readAllForInjection(1, 'proj');
    assert.ok(result.includes('s1'));
    assert.ok(result.includes('摘要-s1'));
    assert.ok(result.includes('摘要-s2'));
  });

  it('空列表返回空字符串', async () => {
    const service = makeService(async () => [], async () => ({ content: 'x', path: '' }));
    assert.equal(await service.readAllForInjection(1, 'proj'), '');
  });

  it('maxCount 截断（只取前 N 条）', async () => {
    const calls = [];
    const service = makeService(
      async () => [
        { sessionId: 'a', mtime: 3 },
        { sessionId: 'b', mtime: 2 },
        { sessionId: 'c', mtime: 1 },
      ],
      async (_u, _p, sid) => { calls.push(sid); return { content: `摘要-${sid}`, path: '' }; },
    );
    const result = await service.readAllForInjection(1, 'proj', 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls, ['a', 'b']);
    assert.ok(result.includes('摘要-a'));
    assert.ok(result.includes('摘要-b'));
    assert.ok(!result.includes('摘要-c'));
  });

  it('单条 read 失败跳过，不影响其他', async () => {
    const service = makeService(
      async () => [
        { sessionId: 's1', mtime: 1 },
        { sessionId: 's2', mtime: 2 },
      ],
      async (_u, _p, sid) => {
        if (sid === 's1') throw new Error('read fail');
        return { content: `摘要-${sid}`, path: '' };
      },
    );
    const result = await service.readAllForInjection(1, 'proj');
    assert.ok(!result.includes('摘要-s1'));
    assert.ok(result.includes('摘要-s2'));
  });

  it('空 content 的条目跳过', async () => {
    const service = makeService(
      async () => [{ sessionId: 's1', mtime: 1 }],
      async () => ({ content: '', path: '' }),
    );
    assert.equal(await service.readAllForInjection(1, 'proj'), '');
  });
});
