/**
 * ReadmeService Integration Tests
 *
 * 通过 mock containerManager 模块对象模拟 Docker 交互，
 * 测试 ReadmeService 完整流程：appendEntry / removeEntry / updateSummary / parseEntries。
 *
 * 核心回归：验证 "删除 A 丢 B" 的 bug 已修复。
 *
 * @module services/documents/__tests__/ReadmeService.integration.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReadmeService } from '../ReadmeService.js';
import containerManager from '../../container/core/index.js';

// ─── Mock 基础设施 ─────────────────────────────────────

/** 保存原始方法以便恢复 */
const _originalGetOrCreateContainer = containerManager.getOrCreateContainer;

/** 存储容器内文件内容的 Map */
let fileStore;

/** 记录 exec 调用的历史 */
let execHistory;

/** ReadmeService 实例 */
let svc;

/**
 * 创建绑定 mock 的 ReadmeService 实例
 */
function createMockedService() {
  const service = new ReadmeService();

  // 拦截 containerManager.getOrCreateContainer — 避免 Docker 和数据库调用
  // readReadme 和 _writeReadme 内部都通过模块级 import 调用此方法
  containerManager.getOrCreateContainer = async () => ({ id: 'mock-container' });

  // 拦截 _execCommand：记录命令但不执行真实 Docker 操作
  service._execCommand = async (userId, cmd) => {
    execHistory.push(cmd);

    // 处理 mkdir -p — 直接成功
    if (cmd[0] === 'mkdir') return;

    // 处理 sh -c 写入命令
    if (cmd[0] === 'sh' && cmd[1] === '-c') {
      const script = cmd[2];
      // 提取 heredoc 内容：cat > '...tmp' << 'README_EOF_xxx_yyy'\nCONTENT\nREADME_EOF_xxx_yyy\nmv ...
      // 分隔符为动态生成，格式 README_EOF_{timestamp}_{random}
      const heredocMatch = script.match(/cat\s+>\s+'[^']*'\s+<<\s+'(README_EOF_[^']+)'\n([\s\S]*?)\n\1/);
      if (heredocMatch) {
        // 提取 mv 目标路径
        const mvMatch = script.match(/mv\s+'[^']*'\s+'([^']*)'/);
        if (mvMatch) {
          fileStore[mvMatch[1]] = heredocMatch[2];
        }
      }
    }
  };

  // 拦截 _readFile：从 fileStore 返回内容
  service._readFile = async (userId, filePath) => {
    return fileStore[filePath] ?? null;
  };

  return service;
}

beforeEach(() => {
  fileStore = {};
  execHistory = [];
  svc = createMockedService();
});

afterEach(() => {
  // 恢复原始方法，避免污染其他测试
  containerManager.getOrCreateContainer = _originalGetOrCreateContainer;
});

// ─── 测试用例 ──────────────────────────────────────────

describe('ReadmeService appendEntry → readReadme', () => {
  it('追加条目后能读取到', async () => {
    await svc.appendEntry(1, 'proj', {
      fileName: 'test.pdf',
      fileSize: 1024 * 1024,
      summary: '这是一篇关于专利的文档',
    });

    const content = await svc.readReadme(1, 'proj');
    assert.ok(content, 'readme 应有内容');
    assert.ok(content.includes('## test.pdf'), '应包含文件名');
    assert.ok(content.includes('摘要: 这是一篇关于专利的文档'), '应包含摘要');
    assert.ok(content.includes('1.0MB'), '应包含格式化大小');
  });
});

describe('ReadmeService 连续追加', () => {
  it('连续追加两个文件 → 两个条目都存在', async () => {
    await svc.appendEntry(1, 'proj', {
      fileName: 'alpha.pdf',
      fileSize: 2048,
      summary: 'Alpha 摘要',
    });
    await svc.appendEntry(1, 'proj', {
      fileName: 'beta.docx',
      fileSize: 4096,
      summary: 'Beta 摘要',
    });

    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('## alpha.pdf'), '应有 alpha');
    assert.ok(content.includes('## beta.docx'), '应有 beta');
    assert.ok(content.includes('Alpha 摘要'), '应有 alpha 摘要');
    assert.ok(content.includes('Beta 摘要'), '应有 beta 摘要');
  });
});

describe('ReadmeService removeEntry — 删除 A 不丢 B（核心回归）', () => {
  it('删除中间条目不影响前后条目', async () => {
    // 先追加三个
    await svc.appendEntry(1, 'proj', { fileName: 'first.pdf', fileSize: 100, summary: 'FIRST' });
    await svc.appendEntry(1, 'proj', { fileName: 'middle.pdf', fileSize: 200, summary: 'MIDDLE' });
    await svc.appendEntry(1, 'proj', { fileName: 'last.pdf', fileSize: 300, summary: 'LAST' });

    // 删除中间
    await svc.removeEntry(1, 'proj', 'middle.pdf');

    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('## first.pdf'), 'first 应保留');
    assert.ok(content.includes('## last.pdf'), 'last 应保留');
    assert.ok(content.includes('FIRST'), 'first 摘要应保留');
    assert.ok(content.includes('LAST'), 'last 摘要应保留');
    assert.ok(!content.includes('## middle.pdf'), 'middle 应移除');
    assert.ok(!content.includes('MIDDLE'), 'middle 摘要应移除');

    // parseEntries 验证一致性
    const entries = await svc.parseEntries(1, 'proj');
    assert.equal(entries.length, 2, '应只有 2 个条目');
    assert.equal(entries[0].fileName, 'first.pdf');
    assert.equal(entries[1].fileName, 'last.pdf');
  });

  it('删除第一个条目', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: 'A' });
    await svc.appendEntry(1, 'proj', { fileName: 'b.pdf', fileSize: 200, summary: 'B' });

    await svc.removeEntry(1, 'proj', 'a.pdf');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(!content.includes('## a.pdf'));
    assert.ok(content.includes('## b.pdf'));
  });

  it('删除最后一个条目', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: 'A' });
    await svc.appendEntry(1, 'proj', { fileName: 'b.pdf', fileSize: 200, summary: 'B' });

    await svc.removeEntry(1, 'proj', 'b.pdf');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('## a.pdf'));
    assert.ok(!content.includes('## b.pdf'));
  });

  it('删除不存在的条目不影响内容', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: 'A' });
    const before = await svc.readReadme(1, 'proj');

    await svc.removeEntry(1, 'proj', 'nonexistent.pdf');
    const after = await svc.readReadme(1, 'proj');

    assert.equal(after, before, '内容不应变化');
  });
});

describe('ReadmeService updateSummary', () => {
  it('更新指定文件的摘要文本', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'test.pdf', fileSize: 1024, summary: '旧摘要' });

    await svc.updateSummary(1, 'proj', 'test.pdf', '新摘要内容');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('摘要: 新摘要内容'), '摘要应更新');
    assert.ok(!content.includes('旧摘要'), '旧摘要应被替换');
  });

  it('更新一个文件的摘要不影响其他文件', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: '摘要A' });
    await svc.appendEntry(1, 'proj', { fileName: 'b.pdf', fileSize: 200, summary: '摘要B' });

    await svc.updateSummary(1, 'proj', 'a.pdf', '更新后的A');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('更新后的A'), 'a 的摘要应更新');
    assert.ok(content.includes('摘要B'), 'b 的摘要不应变');
  });
});

describe('ReadmeService parseEntries', () => {
  it('正确返回所有 fileName + summary', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'x.pdf', fileSize: 100, summary: '摘要X' });
    await svc.appendEntry(1, 'proj', { fileName: 'y.docx', fileSize: 200, summary: '摘要Y' });

    const entries = await svc.parseEntries(1, 'proj');
    assert.equal(entries.length, 2);
    assert.equal(entries[0].fileName, 'x.pdf');
    assert.equal(entries[0].summary, '摘要X');
    assert.equal(entries[1].fileName, 'y.docx');
    assert.equal(entries[1].summary, '摘要Y');
  });

  it('空 readme 返回空数组', async () => {
    const entries = await svc.parseEntries(1, 'empty-proj');
    assert.deepEqual(entries, []);
  });
});

// ─── 摘要状态行（error 持久化） ─────────────────────────

describe('ReadmeService 摘要状态行（error 持久化）', () => {
  it('appendEntry status=failed 写出 - 状态: 失败 行', async () => {
    await svc.appendEntry(1, 'proj', {
      fileName: 'bad.pdf',
      fileSize: 100,
      summary: '（摘要生成失败，请手动编辑）',
      status: 'failed',
    });
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('- 状态: 失败'), '失败条目应含状态行');
  });

  it('appendEntry 成功（省略 status）不写状态行', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'ok.pdf', fileSize: 100, summary: '正常摘要' });
    const content = await svc.readReadme(1, 'proj');
    assert.ok(!content.includes('- 状态:'), '成功条目不应有状态行');
  });

  it('parseEntries：失败条目 status=error，成功条目 status=ready', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'bad.pdf', fileSize: 100, summary: '失败摘要', status: 'failed' });
    await svc.appendEntry(1, 'proj', { fileName: 'ok.pdf', fileSize: 100, summary: '正常摘要' });
    const entries = await svc.parseEntries(1, 'proj');
    const bad = entries.find((e) => e.fileName === 'bad.pdf');
    const ok = entries.find((e) => e.fileName === 'ok.pdf');
    assert.equal(bad.status, 'error');
    assert.equal(ok.status, 'ready');
  });

  it('parseEntries 向后兼容：旧格式（无状态行）视为 ready', async () => {
    // 直接写旧格式 readme 到 fileStore（绕过 appendEntry）
    fileStore['/workspace/legacy/readme.md'] = [
      '# 项目文档索引',
      '',
      '## legacy.pdf',
      '- 摘要: 旧条目无状态行',
    ].join('\n');
    const entries = await svc.parseEntries(1, 'legacy');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].status, 'ready', '旧格式应视为 ready');
  });

  it('updateSummary 清除失败状态行（手动填写 → ready）', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'bad.pdf', fileSize: 100, summary: '失败摘要', status: 'failed' });
    await svc.updateSummary(1, 'proj', 'bad.pdf', '我手动填写的摘要');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('摘要: 我手动填写的摘要'), '摘要应更新');
    assert.ok(!content.includes('- 状态: 失败'), '状态行应被清除');
  });

  it('updateSummary 对不存在的条目：append-if-missing 创建 ready 条目', async () => {
    await svc.updateSummary(1, 'proj', 'newbie.pdf', '手动创建的摘要');
    const content = await svc.readReadme(1, 'proj');
    assert.ok(content.includes('## newbie.pdf'), '应创建条目');
    assert.ok(content.includes('摘要: 手动创建的摘要'));
    assert.ok(!content.includes('- 状态:'), '应为 ready 无状态行');
  });
});

// ─── 并发写串行化（Bug 2: read-modify-write 覆盖） ────────

describe('ReadmeService 并发写串行化（Bug 2）', () => {
  it('并发 appendEntry 两个条目，两者都保留（不互相覆盖）', async () => {
    await Promise.all([
      svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: '摘要A' }),
      svc.appendEntry(1, 'proj', { fileName: 'b.pdf', fileSize: 100, summary: '摘要B' }),
    ]);
    const entries = await svc.parseEntries(1, 'proj');
    const names = entries.map((e) => e.fileName);
    assert.ok(names.includes('a.pdf'), 'a 应保留（不被并发写覆盖）');
    assert.ok(names.includes('b.pdf'), 'b 应保留');
  });

  it('并发 appendEntry + removeEntry 不互相破坏', async () => {
    await svc.appendEntry(1, 'proj', { fileName: 'a.pdf', fileSize: 100, summary: 'A' });
    await svc.appendEntry(1, 'proj', { fileName: 'b.pdf', fileSize: 100, summary: 'B' });

    // 并发：追加 c + 删除 a
    await Promise.all([
      svc.appendEntry(1, 'proj', { fileName: 'c.pdf', fileSize: 100, summary: 'C' }),
      svc.removeEntry(1, 'proj', 'a.pdf'),
    ]);
    const entries = await svc.parseEntries(1, 'proj');
    const names = entries.map((e) => e.fileName);
    assert.ok(!names.includes('a.pdf'), 'a 应被删除');
    assert.ok(names.includes('b.pdf'), 'b 应保留');
    assert.ok(names.includes('c.pdf'), 'c 应保留');
  });
});
