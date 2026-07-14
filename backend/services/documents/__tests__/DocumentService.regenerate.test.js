/**
 * DocumentService.regenerateSummary 单元测试
 *
 * 验证「重新生成摘要」端点的核心逻辑：
 * - 复用 pendingSummaryKeys 做 in-flight 去重（与 _recoverPendingAISummaries 互补）；
 * - 先 removeEntry 清旧段落，再 fire-and-forget generateSummary；
 * - removeEntry 失败时释放锁并抛错，不进入 generate（防重复条目）。
 *
 * @module services/documents/__tests__/DocumentService.regenerate.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentService, _resetRecoveryStateForTests } from '../DocumentService.js';
import { summaryService } from '../SummaryService.js';
import { readmeService } from '../ReadmeService.js';

describe('DocumentService.regenerateSummary 正常路径与去重', () => {
  let removeMock;
  let genMock;
  let sizeMock;
  /** 收集 generateSummary mock 返回的 promise resolver */
  let resolvers;
  let svc;

  beforeEach(() => {
    _resetRecoveryStateForTests();
    resolvers = [];
    removeMock = mock.method(readmeService, 'removeEntry', () => Promise.resolve());
    genMock = mock.method(summaryService, 'generateSummary', () =>
      new Promise((resolve) => resolvers.push(resolve)));
    svc = new DocumentService();
    // mock _getFileSize，避免测试连真实 Docker（regenerateSummary 会读取文件大小）
    sizeMock = mock.method(svc, '_getFileSize', () => Promise.resolve(1024));
  });

  afterEach(() => {
    resolvers.forEach((r) => r());
    removeMock.mock.restore();
    genMock.mock.restore();
    sizeMock.mock.restore();
  });

  it('调用一次：removeEntry + generateSummary 各一次，返回 pending', async () => {
    const result = await svc.regenerateSummary(
      1, 'proj', '/workspace/proj/documents/uploads/a.pdf', 'a.pdf', 'upload',
    );
    assert.deepEqual(result, { summary_status: 'pending' });
    assert.equal(removeMock.mock.callCount(), 1);
    assert.equal(genMock.mock.callCount(), 1);
    assert.equal(sizeMock.mock.callCount(), 1, '应读取一次文件大小');
    const arg = genMock.mock.calls[0].arguments[2];
    assert.equal(arg.file_name, 'a.pdf');
    assert.equal(arg.source, 'upload');
    assert.equal(arg.file_size, 1024, '应传递实际文件大小（非 0，避免 readme 显示"未知"）');
  });

  it('生成完成前再调用：幂等返回 pending，不重复 removeEntry/generate', async () => {
    await svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload');
    const result2 = await svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload');
    assert.deepEqual(result2, { summary_status: 'pending' });
    assert.equal(removeMock.mock.callCount(), 1, '不应重复 removeEntry');
    assert.equal(genMock.mock.callCount(), 1, '不应重复 generate');
  });

  it('生成完成后释放锁，可再次触发', async () => {
    await svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload');
    assert.equal(genMock.mock.callCount(), 1);

    resolvers[0](); // 生成完成
    await new Promise((r) => setImmediate(r)); // 等 .finally 释放锁

    await svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload');
    assert.equal(genMock.mock.callCount(), 2, '锁释放后可再次触发');
  });
});

describe('DocumentService.regenerateSummary removeEntry 失败', () => {
  let removeMock;
  let genMock;
  let svc;

  beforeEach(() => {
    _resetRecoveryStateForTests();
    removeMock = mock.method(readmeService, 'removeEntry', () =>
      Promise.reject(new Error('docker down')));
    genMock = mock.method(summaryService, 'generateSummary', () => Promise.resolve());
    svc = new DocumentService();
  });

  afterEach(() => {
    removeMock.mock.restore();
    genMock.mock.restore();
  });

  it('removeEntry 失败：抛错、不调 generate', async () => {
    await assert.rejects(
      svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload'),
      /docker down/,
    );
    assert.equal(genMock.mock.callCount(), 0, '不应调 generate');
  });

  it('removeEntry 失败后锁已释放，再次调用不卡死', async () => {
    await assert.rejects(svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload'));
    // 锁应已释放：第二次会真正再走 removeEntry（而非被 has(key) 幂等拦截）
    await assert.rejects(svc.regenerateSummary(1, 'proj', '/x/a.pdf', 'a.pdf', 'upload'));
    assert.equal(removeMock.mock.callCount(), 2, '锁释放后第二次应真正调用 removeEntry');
  });
});
