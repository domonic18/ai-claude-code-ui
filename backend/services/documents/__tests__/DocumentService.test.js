/**
 * DocumentService Unit Tests
 *
 * 纯逻辑测试：_sanitizeFilename（文件名清理）与 _resolveUniqueName（同名序号解析）。
 * 不连 Docker：_resolveUniqueName 依赖的 _pathExists 被 stub 为内存判定。
 *
 * @module services/documents/__tests__/DocumentService.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentService } from '../DocumentService.js';

/** 构造无副作用实例（不连 Docker） */
function createService() {
  return new DocumentService();
}

// ─── _sanitizeFilename ─────────────────────────────────────

describe('DocumentService._sanitizeFilename', () => {
  const svc = createService();

  it('正常带扩展名：分离基础名与扩展名', () => {
    assert.deepEqual(svc._sanitizeFilename('交底书.md'), { baseName: '交底书', ext: '.md' });
  });

  it('无扩展名：ext 为空串', () => {
    assert.deepEqual(svc._sanitizeFilename('交底书'), { baseName: '交底书', ext: '' });
  });

  it('非法字符（空格/括号）替换为下划线', () => {
    const r = svc._sanitizeFilename('交底书 副本.md');
    assert.equal(r.ext, '.md');
    assert.ok(r.baseName.includes('交底书'));
    assert.ok(r.baseName.includes('_'), '空格应被替换为下划线');
  });

  it('空文件名兜底为「未命名」', () => {
    assert.deepEqual(svc._sanitizeFilename(''), { baseName: '未命名', ext: '' });
  });

  it('纯点号兜底为「未命名」，避免生成 "dir/." 非法路径', () => {
    const r = svc._sanitizeFilename('...');
    assert.equal(r.baseName, '未命名');
  });

  it('单个点号兜底为「未命名」', () => {
    const r = svc._sanitizeFilename('.');
    assert.equal(r.baseName, '未命名');
  });

  it('超长基础名截断到 60 字符', () => {
    const long = 'a'.repeat(80);
    const r = svc._sanitizeFilename(`${long}.md`);
    assert.equal(r.baseName.length, 60);
    assert.equal(r.ext, '.md');
  });

  it('多扩展名取最后一段作为扩展名', () => {
    assert.deepEqual(svc._sanitizeFilename('a.tar.gz'), { baseName: 'a.tar', ext: '.gz' });
  });

  it('保留中文与常见 CJK 字符', () => {
    const r = svc._sanitizeFilename('测试文档_v1.docx');
    assert.deepEqual(r, { baseName: '测试文档_v1', ext: '.docx' });
  });

  it('隐藏文件名（前导点）保持原样，不误判为纯点号', () => {
    const r = svc._sanitizeFilename('.gitignore');
    assert.deepEqual(r, { baseName: '.gitignore', ext: '' });
  });
});

// ─── _resolveUniqueName ─────────────────────────────────────

describe('DocumentService._resolveUniqueName', () => {
  it('原名不存在时直接返回原名（不加任何后缀）', async () => {
    const svc = createService();
    svc._pathExists = async () => false;
    const name = await svc._resolveUniqueName(1, '/workspace/p/documents/uploads', '交底书', '.md');
    assert.equal(name, '交底书.md');
  });

  it('原名已存在时追加 _1', async () => {
    const svc = createService();
    svc._pathExists = async (_uid, fullPath) => fullPath.endsWith('/交底书.md');
    const name = await svc._resolveUniqueName(1, '/dir', '交底书', '.md');
    assert.equal(name, '交底书_1.md');
  });

  it('原名与 _1 均存在时追加 _2', async () => {
    const svc = createService();
    svc._pathExists = async (_uid, fullPath) =>
      fullPath.endsWith('/交底书.md') || fullPath.endsWith('/交底书_1.md');
    const name = await svc._resolveUniqueName(1, '/dir', '交底书', '.md');
    assert.equal(name, '交底书_2.md');
  });

  it('无扩展名时序号正确拼接', async () => {
    const svc = createService();
    svc._pathExists = async (_uid, fullPath) => fullPath.endsWith('/交底书');
    const name = await svc._resolveUniqueName(1, '/dir', '交底书', '');
    assert.equal(name, '交底书_1');
  });

  it('连续 3 个已存在时返回 _3', async () => {
    const svc = createService();
    svc._pathExists = async (_uid, fullPath) =>
      ['/交底书.md', '/交底书_1.md', '/交底书_2.md'].some(s => fullPath.endsWith(s));
    const name = await svc._resolveUniqueName(1, '/dir', '交底书', '.md');
    assert.equal(name, '交底书_3.md');
  });

  it('原名为空 baseName 时仍能生成有效名（防御）', async () => {
    const svc = createService();
    svc._pathExists = async () => false;
    // 实际 uploadDocument 会先经 _sanitizeFilename 兜底，此处仅验证拼接不产生空名
    const name = await svc._resolveUniqueName(1, '/dir', '未命名', '');
    assert.equal(name, '未命名');
    assert.ok(name.length > 0);
  });
});
