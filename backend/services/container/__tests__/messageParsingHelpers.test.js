/**
 * messageParsingHelpers 单元测试
 *
 * 重点验证 extractMessageContext 对 Edit/Write 工具调用的内容提取：
 * AI 生成的章节正文（new_string / content）是上下文膨胀的主要来源，
 * 需记录完整尺寸（*Chars）+ 200 字预览（*Preview），且不破坏原有 file 提取。
 *
 * @module services/container/__tests__/messageParsingHelpers.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMessageContext, extractToolResults } from '../claude/messageParsingHelpers.js';

// 构造 >200 字的中文正文（模拟一章专利内容）；repeat 保证远超预览阈值
const LONG_BODY = '一种基于决策可视化痕迹的智能代码变更审核方法,其特征在于包括以下步骤。'.repeat(20);

describe('extractMessageContext — Edit 内容提取', () => {

  it('Edit: file + newStringChars(完整长度) + newStringPreview(200字+省略号)', () => {
    const ctx = extractMessageContext({
      content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_abc12345', input: {
        file_path: '/workspace/我的工作区/generated_docs/独立权利要求.md',
        old_string: '<!-- TODO_独权 -->',
        new_string: LONG_BODY,
      }}],
    });

    assert.equal(ctx.contentType, 'tool_use');
    const e = ctx.tools[0];
    assert.equal(e.name, 'Edit');
    assert.equal(e.input.file, '/workspace/我的工作区/generated_docs/独立权利要求.md');
    assert.equal(e.input.newStringChars, LONG_BODY.length, 'newStringChars 必须是完整长度，不能截断');
    assert.equal(e.input.newStringPreview.length, 203, '预览长度 = 200字 + "..."');
    assert.ok(e.input.newStringPreview.endsWith('...'), '超长时尾部必须带省略号');
    assert.ok(e.input.newStringPreview.startsWith('一种基于'), '预览必须保留正文开头');
  });

  it('Edit: 缺失 new_string 时不报错，newStringChars=0、preview=undefined', () => {
    const ctx = extractMessageContext({
      content: [{ type: 'tool_use', name: 'Edit', id: 'x', input: { file_path: '/a.md' } }],
    });
    const e = ctx.tools[0].input;
    assert.equal(e.newStringChars, 0);
    assert.equal(e.newStringPreview, undefined, '空值走 truncate 兜底返回原值(undefined)');
  });

  it('Edit: old_string 不被记录（只关心新生成内容 new_string）', () => {
    const ctx = extractMessageContext({
      content: [{ type: 'tool_use', name: 'Edit', id: 'y', input: {
        file_path: '/a.md', old_string: '旧'.repeat(5000), new_string: '新内容',
      }}],
    });
    const e = ctx.tools[0].input;
    assert.equal(e.newStringChars, 3);
    assert.equal(e.newStringPreview, '新内容');
    assert.equal('old_string' in e, false, 'old_string 不应出现在日志字段');
  });
});

describe('extractMessageContext — Write 内容提取', () => {

  it('Write: contentChars + contentPreview', () => {
    const ctx = extractMessageContext({
      content: [{ type: 'tool_use', name: 'Write', id: 'w1', input: {
        file_path: '/workspace/docs/x.md', content: LONG_BODY,
      }}],
    });
    const w = ctx.tools[0].input;
    assert.equal(w.file, '/workspace/docs/x.md');
    assert.equal(w.contentChars, LONG_BODY.length);
    assert.equal(w.contentPreview.length, 203);
    assert.ok(w.contentPreview.endsWith('...'));
  });

  it('Write: 用 path 而非 file_path（兼容）+ 短内容不截断', () => {
    const ctx = extractMessageContext({
      content: [{ type: 'tool_use', name: 'Write', id: 'w2', input: { path: '/c.md', content: '短内容' } }],
    });
    const w = ctx.tools[0].input;
    assert.equal(w.file, '/c.md', 'file_path || path 兼容');
    assert.equal(w.contentChars, 3);
    assert.equal(w.contentPreview, '短内容', '短于阈值原样返回，不带省略号');
  });
});

describe('extractToolResults — 回归保护（未改动，确认未破坏）', () => {

  it('tool_result: resultChars 记完整长度，resultPreview 按 LOG_TOOL_RESULT_MAX 截断', () => {
    const ctx = extractToolResults({
      content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: LONG_BODY }],
    });
    assert.equal(ctx.length, 1);
    assert.equal(ctx[0].resultChars, LONG_BODY.length, '完整字符数始终记录');
    assert.ok(ctx[0].resultPreview.length <= 100000, '预览受 LOG_TOOL_RESULT_MAX 限制');
  });
});
