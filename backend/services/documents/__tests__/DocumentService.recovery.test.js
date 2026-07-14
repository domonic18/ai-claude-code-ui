/**
 * DocumentService 兜底补触发单元测试
 *
 * 验证 _recoverPendingAISummaries：为「没人管」的 pending AI 文档补触发摘要生成，
 * 并用 in-flight 锁（pendingSummaryKeys）防止轮询期间重复触发——
 * readme.appendEntry 不去重，重复触发会写出多个重复条目。
 *
 * @module services/documents/__tests__/DocumentService.recovery.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentService, _resetRecoveryStateForTests } from '../DocumentService.js';
import { summaryService } from '../SummaryService.js';

describe('DocumentService._recoverPendingAISummaries', () => {
  let genMock;
  /** 收集每次 mock 返回的 promise resolver，便于用例精确控制 in-flight 释放时机 */
  let resolvers;
  let svc;

  beforeEach(() => {
    _resetRecoveryStateForTests();
    resolvers = [];
    // 用可控 promise 模拟 generateSummary（真实方法返回永不 reject 的 promise）
    genMock = mock.method(summaryService, 'generateSummary', () =>
      new Promise((resolve) => resolvers.push(resolve))
    );
    svc = new DocumentService();
  });

  afterEach(() => {
    // 释放所有 in-flight promise，触发 .finally 清锁，避免泄漏到其他用例
    resolvers.forEach((r) => r());
    genMock.mock.restore();
  });

  it('pending 的 AI 文档：补触发一次摘要生成，且 source=ai（启用重试）', () => {
    svc._recoverPendingAISummaries(1, 'proj', [
      { file_name: 'a.md', file_path: '/workspace/proj/generated_docs/a.md', file_size: 10, summary_status: 'pending' },
    ]);
    assert.equal(genMock.mock.callCount(), 1);
    const arg = genMock.mock.calls[0].arguments[2];
    assert.equal(arg.source, 'ai');
    assert.equal(arg.file_name, 'a.md');
  });

  it('ready 的文档不触发', () => {
    svc._recoverPendingAISummaries(1, 'proj', [
      { file_name: 'a.md', file_path: '/x/a.md', file_size: 10, summary_status: 'ready' },
    ]);
    assert.equal(genMock.mock.callCount(), 0);
  });

  it('同一 pending 文档在生成完成前不重复触发（in-flight 锁）', () => {
    const doc = { file_name: 'a.md', file_path: '/x/a.md', file_size: 10, summary_status: 'pending' };
    svc._recoverPendingAISummaries(1, 'proj', [doc]);
    svc._recoverPendingAISummaries(1, 'proj', [doc]);
    svc._recoverPendingAISummaries(1, 'proj', [doc]);
    assert.equal(genMock.mock.callCount(), 1, 'in-flight 期间应只触发一次');
  });

  it('生成完成后释放锁，再次调用才会重新触发', async () => {
    const doc = { file_name: 'a.md', file_path: '/x/a.md', file_size: 10, summary_status: 'pending' };
    svc._recoverPendingAISummaries(1, 'proj', [doc]);
    assert.equal(genMock.mock.callCount(), 1);

    resolvers[0](); // 摘要生成完成
    await new Promise((r) => setImmediate(r)); // 等 .finally 释放锁

    svc._recoverPendingAISummaries(1, 'proj', [doc]);
    assert.equal(genMock.mock.callCount(), 2, '锁释放后可再次触发');
  });

  it('不同文件互不影响，各自触发', () => {
    svc._recoverPendingAISummaries(1, 'proj', [
      { file_name: 'a.md', file_path: '/x/a.md', file_size: 10, summary_status: 'pending' },
      { file_name: 'b.md', file_path: '/x/b.md', file_size: 10, summary_status: 'pending' },
    ]);
    assert.equal(genMock.mock.callCount(), 2);
  });

  it('error 态文档不补触发（仅 pending 才补）', () => {
    svc._recoverPendingAISummaries(1, 'proj', [
      { file_name: 'a.md', file_path: '/x/a.md', file_size: 10, summary_status: 'error' },
    ]);
    assert.equal(genMock.mock.callCount(), 0, 'error 是终态，不应被补触发');
  });
});
