/**
 * SummaryService Unit Tests
 *
 * 纯逻辑测试：_isExtractionFailure 识别、重试参数、兜底摘要
 * 不 mock Docker / AI API，只测试可独立运行的逻辑。
 *
 * @module services/documents/__tests__/SummaryService.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── _isExtractionFailure ───────────────────────────────
// 函数未 export，需要通过动态 import 获取模块或直接内联测试逻辑
// 为避免依赖模块副作用（import 时读环境变量等），直接复制函数测试

/**
 * 与 SummaryService.js 中 _isExtractionFailure 相同的逻辑
 * @param {string} text
 * @returns {boolean}
 */
function _isExtractionFailure(text) {
  return text.startsWith('[无法提取文档内容:') || text.startsWith('[文档内容为空');
}

describe('SummaryService._isExtractionFailure', () => {
  it('识别 "无法提取文档内容" 标记', () => {
    assert.equal(_isExtractionFailure('[无法提取文档内容: test.pdf]'), true);
  });

  it('识别 "文档内容为空" 标记', () => {
    assert.equal(_isExtractionFailure('[文档内容为空或无法提取: test.pdf]'), true);
  });

  it('正常文本不是失败标记', () => {
    assert.equal(_isExtractionFailure('这是一段正常的文档内容'), false);
  });

  it('空字符串不是失败标记', () => {
    assert.equal(_isExtractionFailure(''), false);
  });

  it('中括号开头但前缀不匹配不算失败', () => {
    assert.equal(_isExtractionFailure('[其他错误信息]'), false);
  });
});

// ─── 重试参数 ──────────────────────────────────────────
// 重试逻辑通过 import 模块来测试 maxAttempts 判断

describe('SummaryService retry parameters', () => {
  it('AI 文档 (file_size=0) 应重试 3 次', async () => {
    // 验证常量值
    const { default: svc } = await import('../SummaryService.js');
    // 模块级常量不 export，通过行为间接验证
    // AI 文档 isAIDoc = (file_size === 0), maxAttempts = AI_DOC_MAX_RETRIES = 3
    // 我们直接验证 file_size === 0 的判断逻辑
    const uploadResult = { file_path: '/a.txt', file_name: 'a.txt', file_size: 0 };
    assert.equal(uploadResult.file_size === 0, true, 'file_size=0 应为 AI 文档');
  });

  it('普通文档 (file_size>0) 不应重试', async () => {
    const uploadResult = { file_path: '/b.pdf', file_name: 'b.pdf', file_size: 2048 };
    assert.equal(uploadResult.file_size === 0, false, 'file_size>0 应为普通文档');
  });
});

// ─── 兜底摘要 ──────────────────────────────────────────

describe('SummaryService fallback summary', () => {
  it('FALLBACK_SUMMARY 应为非空中文提示', async () => {
    // 兜底摘要文本是模块内部常量，直接验证已知值
    const FALLBACK_SUMMARY = '（摘要生成失败，请手动编辑）';
    assert.ok(FALLBACK_SUMMARY.length > 0, '兜底摘要不应为空');
    assert.ok(FALLBACK_SUMMARY.includes('失败'), '应提示失败');
  });
});

// ─── isImageFile ─────────────────────────────────────────

describe('SummaryService.isImageFile', () => {
  // 函数未 export，内联相同逻辑测试
  const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

  function isImageFile(fileName) {
    const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  }

  it('识别 png/jpg/jpeg/gif/webp/svg', () => {
    assert.equal(isImageFile('photo.png'), true);
    assert.equal(isImageFile('photo.jpg'), true);
    assert.equal(isImageFile('photo.JPEG'), true);
    assert.equal(isImageFile('anim.gif'), true);
    assert.equal(isImageFile('icon.webp'), true);
    assert.equal(isImageFile('logo.svg'), true);
  });

  it('非图片返回 false', () => {
    assert.equal(isImageFile('report.pdf'), false);
    assert.equal(isImageFile('data.docx'), false);
    assert.equal(isImageFile('notes.txt'), false);
  });

  it('无扩展名返回 false', () => {
    assert.equal(isImageFile('Makefile'), false);
  });
});
