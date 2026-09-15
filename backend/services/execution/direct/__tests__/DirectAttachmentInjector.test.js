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
  isAllowedAttachmentPath,
  DIRECT_DOCS_TOTAL_MAX_CHARS,
} from '../DirectAttachmentInjector.js';

/** 恒等 realpath 解析器（路径真实存在、无 symlink 的默认情形） */
const identityRealpath = async (userId, filePath) => filePath;

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

  it('should remove zero-width and RTL override characters entirely', () => {
    // \u200B 零宽空格 / \u202E RTL 覆盖符：肉眼不可见但模型可读，必须剔除
    assert.equal(escapeFileName('a\u200Bb\u202Ec'), 'abc');
    assert.equal(escapeFileName('report\u202Efdp.exe'), 'reportfdp.exe');
  });

  it('should remove BOM and directional marks', () => {
    assert.equal(escapeFileName('\uFEFF报告\u200F.pdf'), '报告.pdf');
  });

  it('should replace C0/DEL control characters with space', () => {
    assert.equal(escapeFileName('a\u0000b\u007Fcd'), 'a b cd');
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

describe('isAllowedAttachmentPath', () => {
  it('should allow paths under documents/uploads of the current project', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/p/documents/uploads/2026-09-14/a.pdf', 'p'), true);
  });

  it('should allow paths under legacy uploads channel', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/p/uploads/2026-09-14/img.png', 'p'), true);
  });

  it('should reject paths outside upload dirs (session jsonl / project root)', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/p/.claude/projects/x/s.jsonl', 'p'), false);
    assert.equal(isAllowedAttachmentPath('/workspace/p/secret.txt', 'p'), false);
    assert.equal(isAllowedAttachmentPath('/etc/passwd', 'p'), false);
  });

  it('should reject other projects and non-workspace paths', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/other/documents/uploads/a.pdf', 'p'), false);
    assert.equal(isAllowedAttachmentPath('/workspace/p.evil/documents/uploads/a.pdf', 'p'), false);
  });

  it('should reject traversal segments', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/p/documents/uploads/../../s.jsonl', 'p'), false);
    assert.equal(isAllowedAttachmentPath('/workspace/p/../other/uploads/a.pdf', 'p'), false);
  });

  it('should reject invalid projectName or non-string path', () => {
    assert.equal(isAllowedAttachmentPath('/workspace/p/documents/uploads/a.pdf', 'p/../q'), false);
    assert.equal(isAllowedAttachmentPath('/workspace/p/documents/uploads/a.pdf', ''), false);
    assert.equal(isAllowedAttachmentPath(null, 'p'), false);
    assert.equal(isAllowedAttachmentPath('/workspace/p/documents/uploads/a.pdf', null), false);
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
    const content = await buildDirectUserContent(1, attachments, '总结', { projectName: 'p', extractor: fakeExtractor, realpathResolver: identityRealpath });

    assert.ok(Array.isArray(content));
    assert.equal(content[0].type, 'image');
    assert.equal(content[content.length - 1].type, 'text');
    assert.match(content[content.length - 1].text, /PDF 内容/);
    assert.match(content[content.length - 1].text, /总结$/);
  });

  it('should inject document text as plain string when no images', async () => {
    const attachments = [{ name: 'doc.docx', path: '/workspace/proj/documents/uploads/x.docx' }];
    const fakeExtractor = { extractText: async () => 'WORD 内容' };
    const content = await buildDirectUserContent(1, attachments, '看看', { projectName: 'proj', extractor: fakeExtractor, realpathResolver: identityRealpath });

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
    const attachments = [{ name: 'a.pdf', path: '/workspace/p/documents/uploads/a.pdf' }];
    await buildDirectUserContent(1, attachments, 'q', { projectName: 'p', extractor: fakeExtractor, maxDocChars: 12345, realpathResolver: identityRealpath });
    assert.equal(receivedOptions.maxChars, 12345);
  });

  it('should truncate total document chars with explicit marker', async () => {
    const bigText = 'x'.repeat(DIRECT_DOCS_TOTAL_MAX_CHARS);
    const attachments = [
      { name: 'big1.pdf', path: '/workspace/p/documents/uploads/big1.pdf' },
      { name: 'big2.pdf', path: '/workspace/p/documents/uploads/big2.pdf' },
    ];
    const fakeExtractor = { extractText: async () => bigText };
    const content = await buildDirectUserContent(1, attachments, 'q', { projectName: 'p', extractor: fakeExtractor, realpathResolver: identityRealpath });

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

  it('should reject doc attachment outside allowed dirs without calling extractor', async () => {
    let extractorCalls = 0;
    const fakeExtractor = { extractText: async () => { extractorCalls += 1; return 'x'; } };
    const attachments = [{ name: '会话记录.jsonl', path: '/workspace/p/.claude/projects/s/s.jsonl' }];
    const content = await buildDirectUserContent(1, attachments, 'q', { projectName: 'p', extractor: fakeExtractor });

    assert.equal(extractorCalls, 0);
    assert.match(content, /\[附件路径不在允许上传目录，已跳过: 会话记录.jsonl\]/);
  });

  it('should reject image attachment outside allowed dirs (no container read)', async () => {
    const attachments = [{ name: '凭据.png', path: '/workspace/p/creds.png' }];
    const content = await buildDirectUserContent(1, attachments, 'q', { projectName: 'p' });

    assert.match(content, /\[附件路径不在允许上传目录，已跳过: 凭据.png\]/);
  });

  it('should fail-closed on path attachments when projectName missing', async () => {
    let extractorCalls = 0;
    const fakeExtractor = { extractText: async () => { extractorCalls += 1; return 'x'; } };
    const attachments = [{ name: 'a.pdf', path: '/workspace/p/documents/uploads/a.pdf' }];
    const content = await buildDirectUserContent(1, attachments, 'q', { extractor: fakeExtractor });

    assert.equal(extractorCalls, 0);
    assert.match(content, /\[附件路径不在允许上传目录，已跳过: a.pdf\]/);
  });

  it('should reject attachment whose realpath escapes whitelist via symlink (no extractor call)', async () => {
    // symlink 逃逸：白名单内路径经 realpath 解析指向白名单外（如 .claude 密钥）→ 拒读
    let extractorCalls = 0;
    const fakeExtractor = { extractText: async () => { extractorCalls += 1; return 'x'; } };
    const attachments = [{ name: 'k.txt', path: '/workspace/p/documents/uploads/k.txt' }];
    const content = await buildDirectUserContent(1, attachments, 'q', {
      projectName: 'p',
      extractor: fakeExtractor,
      realpathResolver: async () => '/workspace/my-workspace/.claude/api_keys.json',
    });

    assert.equal(extractorCalls, 0);
    assert.match(content, /\[附件路径不在允许上传目录，已跳过: k.txt\]/);
  });

  it('should allow attachment whose realpath stays inside whitelist (symlink to another upload)', async () => {
    const fakeExtractor = { extractText: async () => 'REAL 内容' };
    const attachments = [{ name: 'alias.pdf', path: '/workspace/p/documents/uploads/alias.pdf' }];
    const content = await buildDirectUserContent(1, attachments, 'q', {
      projectName: 'p',
      extractor: fakeExtractor,
      realpathResolver: async () => '/workspace/p/documents/uploads/2026-09-15/real.pdf',
    });

    assert.match(content, /REAL 内容/);
  });

  it('should fail-closed when realpath resolution throws', async () => {
    let extractorCalls = 0;
    const fakeExtractor = { extractText: async () => { extractorCalls += 1; return 'x'; } };
    const attachments = [{ name: 'a.pdf', path: '/workspace/p/documents/uploads/a.pdf' }];
    const content = await buildDirectUserContent(1, attachments, 'q', {
      projectName: 'p',
      extractor: fakeExtractor,
      realpathResolver: async () => { throw new Error('exec failed'); },
    });

    assert.equal(extractorCalls, 0);
    assert.match(content, /\[附件路径不在允许上传目录，已跳过: a.pdf\]/);
  });

  it('should fail-closed when realpath returns empty (null)', async () => {
    const attachments = [{ name: 'a.pdf', path: '/workspace/p/documents/uploads/a.pdf' }];
    const content = await buildDirectUserContent(1, attachments, 'q', {
      projectName: 'p',
      realpathResolver: async () => null,
    });

    assert.match(content, /\[附件路径不在允许上传目录，已跳过: a.pdf\]/);
  });
});
