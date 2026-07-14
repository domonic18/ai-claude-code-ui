/**
 * DocumentService.getProjectDocuments error 状态派生测试
 *
 * 验证 enrichDoc：readme 条目 status=error → summary_status='error'；
 * 无条目 → 'pending'；ready 条目 → 'ready'。
 * 通过 mock 扫描方法与 readmeService.parseEntries，避免真实 Docker 交互。
 *
 * @module services/documents/__tests__/DocumentService.error-status.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentService, _resetRecoveryStateForTests } from '../DocumentService.js';
import { summaryService } from '../SummaryService.js';
import { readmeService } from '../ReadmeService.js';

describe('DocumentService.getProjectDocuments error 状态派生', () => {
  let parseEntriesMock;
  let genMock;
  let scanUploadsMock;
  let scanGeneratedMock;
  let readManifestMock;
  let svc;

  beforeEach(() => {
    _resetRecoveryStateForTests();
    parseEntriesMock = mock.method(readmeService, 'parseEntries', () => Promise.resolve([]));
    genMock = mock.method(summaryService, 'generateSummary', () => Promise.resolve());
    svc = new DocumentService();
    scanUploadsMock = mock.method(svc, '_scanUploads', () => Promise.resolve([]));
    scanGeneratedMock = mock.method(svc, '_scanGeneratedDir', () => Promise.resolve([]));
    readManifestMock = mock.method(svc, '_readAIManifest', () => Promise.resolve([]));
  });

  afterEach(() => {
    parseEntriesMock.mock.restore();
    genMock.mock.restore();
    scanUploadsMock.mock.restore();
    scanGeneratedMock.mock.restore();
    readManifestMock.mock.restore();
  });

  it('error 条目 → summary_status=error', async () => {
    scanUploadsMock.mock.mockImplementation(() => Promise.resolve([
      { file_name: 'bad.pdf', file_path: '/x/bad.pdf', file_size: 10, type: 'upload' },
    ]));
    parseEntriesMock.mock.mockImplementation(() => Promise.resolve([
      { fileName: 'bad.pdf', summary: '失败摘要', status: 'error' },
    ]));

    const result = await svc.getProjectDocuments(1, 'p-error');
    assert.equal(result.uploads[0].summary_status, 'error');
    assert.equal(result.uploads[0].summary, '失败摘要');
  });

  it('无 readme 条目 → pending', async () => {
    scanUploadsMock.mock.mockImplementation(() => Promise.resolve([
      { file_name: 'new.pdf', file_path: '/x/new.pdf', file_size: 10, type: 'upload' },
    ]));
    parseEntriesMock.mock.mockImplementation(() => Promise.resolve([]));

    const result = await svc.getProjectDocuments(1, 'p-pending');
    assert.equal(result.uploads[0].summary_status, 'pending');
  });

  it('ready 条目 → ready', async () => {
    scanUploadsMock.mock.mockImplementation(() => Promise.resolve([
      { file_name: 'ok.pdf', file_path: '/x/ok.pdf', file_size: 10, type: 'upload' },
    ]));
    parseEntriesMock.mock.mockImplementation(() => Promise.resolve([
      { fileName: 'ok.pdf', summary: '正常摘要', status: 'ready' },
    ]));

    const result = await svc.getProjectDocuments(1, 'p-ready');
    assert.equal(result.uploads[0].summary_status, 'ready');
  });
});
