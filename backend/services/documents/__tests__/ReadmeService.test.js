/**
 * ReadmeService Unit Tests
 *
 * 纯逻辑测试：_splitSections、_removeSection、_formatSize
 * 不依赖 Docker，直接调用私有方法。
 *
 * @module services/documents/__tests__/ReadmeService.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReadmeService } from '../ReadmeService.js';

/** 构造一个无副作用实例（不连 Docker） */
function createService() {
  return new ReadmeService();
}

// ─── _splitSections ─────────────────────────────────────

describe('ReadmeService._splitSections', () => {
  const svc = createService();

  it('正确切分 header + 两个 H2 段落', () => {
    const content = [
      '# 项目文档索引',
      '',
      '## alpha.pdf',
      '- 大小: 1.0MB',
      '- 摘要: AAA',
      '',
      '## beta.pdf',
      '- 大小: 2.0MB',
      '- 摘要: BBB',
    ].join('\n');

    const sections = svc._splitSections(content);
    assert.equal(sections.length, 3);
    assert.ok(sections[0].startsWith('# 项目文档索引'));
    assert.ok(sections[1].startsWith('## alpha.pdf'));
    assert.ok(sections[2].startsWith('## beta.pdf'));
  });

  it('只有 header 无条目时返回单元素数组', () => {
    const content = '# 项目文档索引\n';
    const sections = svc._splitSections(content);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].startsWith('#'));
  });

  it('空内容返回空数组', () => {
    const sections = svc._splitSections('   \n  \n');
    assert.equal(sections.length, 0);
  });

  it('条目之间只有一个空行时也能切分', () => {
    const content = '# 项目文档索引\n\n## a.txt\n- 摘要: A\n\n## b.txt\n- 摘要: B';
    const sections = svc._splitSections(content);
    assert.equal(sections.length, 3);
  });
});

// ─── _removeSection ─────────────────────────────────────

describe('ReadmeService._removeSection', () => {
  const svc = createService();

  it('删除中间条目不影响前后条目（修复 "删除 A 丢 B" 的 bug）', () => {
    const content = [
      '# 项目文档索引',
      '',
      '## alpha.pdf',
      '- 大小: 1.0MB',
      '- 摘要: AAA',
      '',
      '## beta.pdf',
      '- 大小: 2.0MB',
      '- 摘要: BBB',
      '',
      '## gamma.pdf',
      '- 大小: 3.0MB',
      '- 摘要: CCC',
    ].join('\n');

    const result = svc._removeSection(content, 'beta.pdf');

    // alpha 和 gamma 必须保留
    assert.ok(result.includes('## alpha.pdf'), 'alpha 应保留');
    assert.ok(result.includes('## gamma.pdf'), 'gamma 应保留');
    assert.ok(result.includes('摘要: AAA'), 'alpha 摘要应保留');
    assert.ok(result.includes('摘要: CCC'), 'gamma 摘要应保留');

    // beta 必须移除
    assert.ok(!result.includes('## beta.pdf'), 'beta 应移除');
    assert.ok(!result.includes('摘要: BBB'), 'beta 摘要应移除');

    // _splitSections + parseEntries 一致性：移除后仍可正确解析
    const remaining = svc._splitSections(result).filter(s => s.startsWith('## '));
    assert.equal(remaining.length, 2, '应只剩 2 个条目');
  });

  it('删除第一个条目', () => {
    const content = [
      '# 项目文档索引',
      '',
      '## first.pdf',
      '- 摘要: FIRST',
      '',
      '## second.pdf',
      '- 摘要: SECOND',
    ].join('\n');

    const result = svc._removeSection(content, 'first.pdf');
    assert.ok(!result.includes('## first.pdf'));
    assert.ok(result.includes('## second.pdf'));
  });

  it('删除最后一个条目', () => {
    const content = [
      '# 项目文档索引',
      '',
      '## first.pdf',
      '- 摘要: FIRST',
      '',
      '## last.pdf',
      '- 摘要: LAST',
    ].join('\n');

    const result = svc._removeSection(content, 'last.pdf');
    assert.ok(result.includes('## first.pdf'));
    assert.ok(!result.includes('## last.pdf'));
  });

  it('文件名不匹配时内容不变', () => {
    const content = '# 项目文档索引\n\n## exists.pdf\n- 摘要: YES';
    const result = svc._removeSection(content, 'nonexistent.pdf');
    assert.equal(result, content.trimEnd());
  });

  it('删除唯一条目后只剩 header', () => {
    const content = '# 项目文档索引\n\n## only.pdf\n- 摘要: ONLY';
    const result = svc._removeSection(content, 'only.pdf');
    assert.ok(result.startsWith('# 项目文档索引'));
    assert.ok(!result.includes('## only.pdf'));
  });

  it('文件名含特殊字符时不误删', () => {
    const content = '# 项目文档索引\n\n## report v1.0.pdf\n- 摘要: R\n\n## report.pdf\n- 摘要: R2';
    const result = svc._removeSection(content, 'report.pdf');
    // 只删 report.pdf，保留 "report v1.0.pdf"
    assert.ok(result.includes('## report v1.0.pdf'));
    assert.ok(!result.includes('## report.pdf'));
  });
});

// ─── _formatSize ────────────────────────────────────────

describe('ReadmeService._formatSize', () => {
  const svc = createService();

  it('0 bytes 返回 "未知"', () => {
    assert.equal(svc._formatSize(0), '未知');
  });

  it('undefined/null 返回 "未知"', () => {
    assert.equal(svc._formatSize(undefined), '未知');
    assert.equal(svc._formatSize(null), '未知');
  });

  it('小于 1KB 显示 B', () => {
    assert.equal(svc._formatSize(512), '512B');
    assert.equal(svc._formatSize(1), '1B');
  });

  it('KB 范围保留一位小数', () => {
    assert.equal(svc._formatSize(1024), '1.0KB');
    assert.equal(svc._formatSize(1536), '1.5KB');
  });

  it('MB 范围保留一位小数', () => {
    assert.equal(svc._formatSize(1024 * 1024), '1.0MB');
    assert.equal(svc._formatSize(2.3 * 1024 * 1024), '2.3MB');
  });
});
