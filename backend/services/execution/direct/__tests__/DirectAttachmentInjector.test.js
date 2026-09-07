/**
 * DirectAttachmentInjector.test.js
 *
 * 直连附件注入器纯函数测试。buildDirectUserContent 的文档分支依赖
 * 注入式 extractor（不 mock 模块顶层），图片容器读取分支留集成验收。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImageBlock,
  escapeFileName,
  buildDocumentSection,
  buildDirectUserContent,
  DIRECT_DOCS_TOTAL_MAX_CHARS,
} from '../DirectAttachmentInjector.js';

describe('buildImageBlock', () => {
  it('should parse valid png data URL', () => {
    const block = buildImageBlock('data:image/png;base64,aGVsbG8=');
    assert.deepEqual(block, {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
    });
  });

  it('should parse jpeg with complex subtype', () => {
    const block = buildImageBlock('data:image/jpeg;base64,xyz');
    assert.equal(block.source.media_type, 'image/jpeg');
  });

  it('should return null for non-image MIME', () => {
    assert.equal(buildImageBlock('data:application/pdf;base64,xyz'), null);
  });

  it('should return null for non-data-URL input', () => {
    assert.equal(buildImageBlock('/workspace/x.png'), null);
    assert.equal(buildImageBlock(''), null);
    assert.equal(buildImageBlock(null), null);
  });
});

describe('escapeFileName', () => {
  it('should strip newlines, backticks and path separators', () => {
    assert.equal(escapeFileName('a`b\nc\rd/e\\f'), 'a b c d e f');
  });

  it('should strip angle brackets (injection markers)', () => {
    assert.equal(escapeFileName('<<system>>.pdf'), 'system  .pdf'.trim());
  });

  it('should fallback to unnamed for empty', () => {
    assert.equal(escapeFileName(''), 'unnamed');
    assert.equal(escapeFileName(null), 'unnamed');
  });
});

describe('buildDocumentSection', () => {
  it('should wrap extracted text with escaped file name', () => {
    const section = buildDocumentSection('报告\n.docx', '内容');
    assert.match(section, /^=== 文件: 报告 .docx ===$/m);
    assert.match(section, /^内容$/m);
    assert.match(section, /^=== 文件结束 ===$/m);
  });
});

describe('buildDirectUserContent', () => {
  it('should return plain command when no attachments', async () => {
    const content = await buildDirectUserContent(1, [], '你好', {});
    assert.equal(content, '你好');
  });

  it('should return plain command for null attachments', async () => {
    const content = await buildDirectUserContent(1, null, '你好', {});
    assert.equal(content, '你好');
  });

  it('should build blocks with image first and text last', async () => {
    const attachments = [
      { name: 'a.png', data: 'data:image/png;base64,AAA=' },
      { name: 'doc.pdf', path: '/workspace/p/documents/uploads/doc.pdf' },
    ];
    const fakeExtractor = { extractText: async () => 'PDF 内容' };
    const content = await buildDirectUserContent(1, attachments, '总结', { extractor: fakeExtractor });

    assert.ok(Array.isArray(content));
    assert.equal(content[0].type, 'image');
    assert.equal(content[content.length - 1].type, 'text');
    assert.match(content[content.length - 1].text, /PDF 内容/);
    assert.match(content[content.length - 1].text, /总结$/);
  });

  it('should inject document text as plain string when no images', async () => {
    const attachments = [{ name: 'doc.docx', path: '/workspace/x.docx' }];
    const fakeExtractor = { extractText: async () => 'WORD 内容' };
    const content = await buildDirectUserContent(1, attachments, '看看', { extractor: fakeExtractor });

    assert.equal(typeof content, 'string');
    assert.match(content, /\[以下是用户引用的文件内容\]/);
    assert.match(content, /WORD 内容/);
    assert.match(content, /看看$/);
  });

  it('should pass maxDocChars to extractor', async () => {
    let receivedOptions = null;
    const fakeExtractor = {
      extractText: async (userId, path, name, options) => {
        receivedOptions = options;
        return 'x';
      },
    };
    const attachments = [{ name: 'a.pdf', path: '/a.pdf' }];
    await buildDirectUserContent(1, attachments, 'q', { extractor: fakeExtractor, maxDocChars: 12345 });
    assert.equal(receivedOptions.maxChars, 12345);
  });

  it('should truncate total document chars with explicit marker', async () => {
    const bigText = 'x'.repeat(DIRECT_DOCS_TOTAL_MAX_CHARS);
    const attachments = [
      { name: 'big1.pdf', path: '/big1.pdf' },
      { name: 'big2.pdf', path: '/big2.pdf' },
    ];
    const fakeExtractor = { extractText: async () => bigText };
    const content = await buildDirectUserContent(1, attachments, 'q', { extractor: fakeExtractor });

    assert.ok(content.length <= DIRECT_DOCS_TOTAL_MAX_CHARS + 500);
    assert.match(content, /\[文件内容总长超限，已截断\]/);
  });

  it('should degrade unreadable image to placeholder text', async () => {
    // data 非法格式（非 dataURL）→ buildImageBlock null → 占位文本
    const attachments = [{ name: '坏图.png', data: 'not-a-data-url' }];
    const content = await buildDirectUserContent(1, attachments, 'q', {});
    assert.equal(typeof content, 'string');
    assert.match(content, /\[图片读取失败: 坏图.png\]/);
  });
});
