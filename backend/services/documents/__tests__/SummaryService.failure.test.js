/**
 * SummaryService 失败收敛单元测试
 *
 * 验证缺口 A 修复：文本提取失败时对所有文档（非仅 AI）early-exit，不调用 AI
 * （避免 AI 总结失败标记产生垃圾 ready 摘要），并写入带 status=failed 的 error 条目，
 * 保证 summary_status 一定从 pending 收敛。同时验证 generateSummary 永不 reject。
 *
 * @module services/documents/__tests__/SummaryService.failure.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { summaryService } from '../SummaryService.js';
import { documentTextExtractor } from '../DocumentTextExtractor.js';
import { readmeService } from '../ReadmeService.js';

describe('SummaryService 失败收敛（缺口 A + error 条目）', () => {
  let extractMock;
  let appendMock;
  let textAiMock;

  beforeEach(() => {
    // 普通文档：extractText 返回提取失败标记（含超时场景）
    extractMock = mock.method(documentTextExtractor, 'extractText', () =>
      '[无法提取文档内容: bad.pdf]');
    appendMock = mock.method(readmeService, 'appendEntry', () => Promise.resolve());
    // 监视 _callTextAIAPI：提取失败时应不被调用
    textAiMock = mock.method(summaryService, '_callTextAIAPI', () => 'should-not-be-called');
  });

  afterEach(() => {
    extractMock.mock.restore();
    appendMock.mock.restore();
    textAiMock.mock.restore();
  });

  it('提取失败：写 error 条目（status=failed + FALLBACK_SUMMARY）且不调 AI', async () => {
    await summaryService._doGenerate(1, 'proj', {
      file_path: '/workspace/proj/documents/uploads/bad.pdf',
      file_name: 'bad.pdf',
      file_size: 2048,
      source: 'upload',
    });

    assert.equal(textAiMock.mock.callCount(), 0, '提取失败不应调 AI（避免垃圾摘要）');
    assert.equal(appendMock.mock.callCount(), 1, '应写一条 error 条目');
    const arg = appendMock.mock.calls[0].arguments[2];
    assert.equal(arg.status, 'failed');
    assert.equal(arg.summary, '（摘要生成失败，请手动编辑）');
  });

  it('generateSummary 返回的 promise 正常 resolve（永不 reject）', async () => {
    await assert.doesNotReject(summaryService.generateSummary(1, 'proj', {
      file_path: '/x/bad.pdf',
      file_name: 'bad.pdf',
      file_size: 2048,
      source: 'upload',
    }));
    assert.equal(appendMock.mock.callCount(), 1, 'generateSummary 内部仍应写 error 条目');
  });
});
