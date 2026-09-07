/**
 * DirectContextBuilder.test.js
 *
 * 直连上下文重建纯函数测试（条目→messages 转换规则）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessagesFromEntries } from '../DirectContextBuilder.js';

describe('buildMessagesFromEntries', () => {
  it('should convert simple string content entries', () => {
    const entries = [
      { type: 'user', message: { role: 'user', content: '问' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '答' }] } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0], { role: 'user', content: '问' });
    assert.deepEqual(messages[1], { role: 'assistant', content: [{ type: 'text', text: '答' }] });
  });

  it('should keep text and image blocks, drop thinking blocks', () => {
    const entries = [{
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '推理', signature: 'sig' },
          { type: 'text', text: '答案' },
        ],
      },
    }, {
      type: 'user',
      message: { role: 'user', content: [{ type: 'image', source: { type: 'base64' } }, { type: 'text', text: '看图' }] },
    }];
    const messages = buildMessagesFromEntries(entries);
    // assistant 只剩 text；user 保留 image+text
    assert.deepEqual(messages[0].content, [{ type: 'text', text: '答案' }]);
    assert.equal(messages[1].content.length, 2);
    assert.equal(messages[1].content[0].type, 'image');
  });

  it('should skip entries without message.role (summary/result)', () => {
    const entries = [
      { type: 'summary', summary: '标题', leafUuid: 'x' },
      { type: 'result', sessionId: 's' },
      { type: 'user', message: { role: 'user', content: '问' } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'user');
  });

  it('should skip API error entries', () => {
    const entries = [
      { type: 'user', message: { role: 'user', content: '问' } },
      { type: 'assistant', isApiErrorMessage: true, message: { role: 'assistant', content: '错误占位' } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 1);
  });

  it('should skip entries whose content becomes empty after filtering', () => {
    const entries = [
      { type: 'user', message: { role: 'user', content: '问' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: '只有思考' }] } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 1);
  });

  it('should merge consecutive same-role entries', () => {
    const entries = [
      { type: 'user', message: { role: 'user', content: '第一段' } },
      { type: 'user', message: { role: 'user', content: '第二段' } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, '第一段\n第二段');
  });

  it('should merge mixed-form same-role entries into blocks', () => {
    const entries = [
      { type: 'user', message: { role: 'user', content: '文本' } },
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: '块' }] } },
    ];
    const messages = buildMessagesFromEntries(entries);
    assert.equal(messages.length, 1);
    assert.ok(Array.isArray(messages[0].content));
    assert.deepEqual(messages[0].content, [
      { type: 'text', text: '文本' },
      { type: 'text', text: '块' },
    ]);
  });

  it('should truncate to maxMessages and drop non-user head', () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push({ type: 'user', message: { role: 'user', content: `u${i}` } });
      entries.push({ type: 'assistant', message: { role: 'assistant', content: `a${i}` } });
    }
    // 20 条交替消息（u0,a0,...,u9,a9），保留最后 5 条 = a7,u8,a8,u9,a9；
    // 截断后首条 a7 非 user 被丢弃，最终 4 条且首条是 user
    const messages = buildMessagesFromEntries(entries, { maxMessages: 5 });
    assert.equal(messages.length, 4);
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[0].content, 'u8');
    assert.equal(messages[3].content, 'a9');
  });

  it('should return empty array for empty input', () => {
    assert.deepEqual(buildMessagesFromEntries([]), []);
    assert.deepEqual(buildMessagesFromEntries(null), []);
  });

  it('should not mutate original entries (deep copy blocks)', () => {
    const blocks = [{ type: 'text', text: '原始' }];
    const entries = [{ type: 'assistant', message: { role: 'assistant', content: blocks } }];
    const messages = buildMessagesFromEntries(entries);
    messages[0].content[0].text = '被改';
    assert.equal(blocks[0].text, '原始');
  });
});
