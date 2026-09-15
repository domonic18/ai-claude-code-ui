/**
 * DirectDocTool.test.js
 *
 * write_generated_doc 工具单测：文件名净化（纯函数）/ 同名序号解析（纯函数）/
 * writeGeneratedDoc 编排（listDir/writeFile 注入，无容器 IO）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFileName,
  resolveUniqueFileName,
  writeGeneratedDoc,
  DIRECT_DOC_TOOLS,
  WRITE_GENERATED_DOC_TOOL,
  MAX_DOC_CONTENT_CHARS,
  MAX_FILE_NAME_STEM_LENGTH,
} from '../DirectDocTool.js';

describe('sanitizeFileName', () => {
  it('应接受常规文件名并强制 .md 后缀', () => {
    assert.deepEqual(sanitizeFileName('技术交底书.md'), { ok: true, fileName: '技术交底书.md' });
    assert.deepEqual(sanitizeFileName('报告'), { ok: true, fileName: '报告.md' });
    assert.deepEqual(sanitizeFileName('REPORT.MD'), { ok: true, fileName: 'REPORT.md' });
  });

  it('应剥路径分隔符仅保留末段（防穿越）', () => {
    assert.deepEqual(sanitizeFileName('a/b/c.md'), { ok: true, fileName: 'c.md' });
    assert.deepEqual(sanitizeFileName('..\\..\\evil.md'), { ok: true, fileName: 'evil.md' });
    assert.deepEqual(sanitizeFileName('generated_docs/../../x.md'), { ok: true, fileName: 'x.md' });
  });

  it('应拒绝空名/纯路径/点段/非字符串', () => {
    assert.equal(sanitizeFileName('').ok, false);
    assert.equal(sanitizeFileName('///').ok, false);
    assert.equal(sanitizeFileName('..').ok, false);
    assert.equal(sanitizeFileName('.').ok, false);
    assert.equal(sanitizeFileName('.md').ok, false);
    assert.equal(sanitizeFileName(null).ok, false);
    assert.equal(sanitizeFileName(123).ok, false);
  });

  it('应剔除控制字符并截断超长主干', () => {
    const ctrl = String.fromCharCode(1, 2, 3);
    assert.deepEqual(sanitizeFileName('a' + ctrl + 'b.md'), { ok: true, fileName: 'ab.md' });
    const long = 'x'.repeat(MAX_FILE_NAME_STEM_LENGTH + 20);
    const r = sanitizeFileName(long + '.md');
    assert.equal(r.ok, true);
    assert.equal(r.fileName.length, MAX_FILE_NAME_STEM_LENGTH + '.md'.length);
  });
});

describe('resolveUniqueFileName', () => {
  it('无冲突时应原样返回', () => {
    assert.equal(resolveUniqueFileName(['a.md'], 'b.md'), 'b.md');
    assert.equal(resolveUniqueFileName([], 'a.md'), 'a.md');
  });

  it('同名时应依次尝试 -1/-2 序号', () => {
    assert.equal(resolveUniqueFileName(['报告.md'], '报告.md'), '报告-1.md');
    assert.equal(resolveUniqueFileName(['报告.md', '报告-1.md'], '报告.md'), '报告-2.md');
  });

  it('应接受数组与 Set 两种入参', () => {
    assert.equal(resolveUniqueFileName(new Set(['a.md']), 'a.md'), 'a-1.md');
    assert.equal(resolveUniqueFileName(['a.md'], 'a.md'), 'a-1.md');
  });
});

describe('writeGeneratedDoc', () => {
  /** 构造注入式依赖：listDir 返回既有文件名，writeFile 记录调用 */
  function makeDeps(existing, writes) {
    return {
      listDir: async () => existing,
      writeFile: async (userId, filePath, content) => { writes.push({ userId, filePath, content }); },
    };
  }

  it('成功写入：路径锚定项目 generated_docs，结果含模型可读反馈', async () => {
    const writes = [];
    const r = await writeGeneratedDoc(
      1, 'proj', { file_name: '报告.md', content: '# 标题' }, makeDeps([], writes),
    );
    assert.equal(r.ok, true);
    assert.equal(r.file_name, '报告.md');
    assert.equal(r.path, '/workspace/proj/generated_docs/报告.md');
    assert.equal(r.chars, '# 标题'.length);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].userId, 1);
    assert.equal(writes[0].filePath, '/workspace/proj/generated_docs/报告.md');
    assert.equal(writes[0].content, '# 标题');
  });

  it('文件名带路径时净化后才写（目标目录结构上不可越界）', async () => {
    const writes = [];
    const r = await writeGeneratedDoc(
      1, 'proj', { file_name: '../../etc/evil.md', content: 'x' }, makeDeps([], writes),
    );
    assert.equal(r.ok, true);
    assert.equal(r.path, '/workspace/proj/generated_docs/evil.md');
  });

  it('同名不覆盖：自动加序号写入', async () => {
    const writes = [];
    const r = await writeGeneratedDoc(
      1, 'proj', { file_name: '报告.md', content: 'x' }, makeDeps(['报告.md'], writes),
    );
    assert.equal(r.ok, true);
    assert.equal(r.file_name, '报告-1.md');
    assert.match(writes[0].filePath, /报告-1\.md$/);
  });

  it('非法项目名应拒绝且不触碰容器', async () => {
    const writes = [];
    for (const bad of ['../x', 'a/b', 'a\\b', '', null, undefined]) {
      const r = await writeGeneratedDoc(1, bad, { file_name: 'a.md', content: 'x' }, makeDeps([], writes));
      assert.equal(r.ok, false, `项目名 ${bad} 应被拒绝`);
      assert.match(r.error, /非法项目名/);
    }
    assert.equal(writes.length, 0);
  });

  it('非法文件名/缺内容/空内容/超长内容应返回失败反馈', async () => {
    const writes = [];
    assert.equal((await writeGeneratedDoc(1, 'p', { file_name: '..', content: 'x' }, makeDeps([], writes))).ok, false);
    assert.equal((await writeGeneratedDoc(1, 'p', { file_name: 'a.md' }, makeDeps([], writes))).ok, false);
    assert.equal((await writeGeneratedDoc(1, 'p', { file_name: 'a.md', content: '' }, makeDeps([], writes))).ok, false);
    const big = 'x'.repeat(MAX_DOC_CONTENT_CHARS + 1);
    const oversized = await writeGeneratedDoc(1, 'p', { file_name: 'a.md', content: big }, makeDeps([], writes));
    assert.equal(oversized.ok, false);
    assert.match(oversized.error, /超过上限/);
    assert.equal(writes.length, 0);
  });

  it('listDir 异常（目录不存在等）应降级为空目录继续写入', async () => {
    const writes = [];
    const r = await writeGeneratedDoc(1, 'p', { file_name: 'a.md', content: 'x' }, {
      listDir: async () => { throw new Error('No such file or directory'); },
      writeFile: async (u, filePath, content) => { writes.push({ filePath, content }); },
    });
    assert.equal(r.ok, true);
    assert.equal(writes.length, 1);
  });
});

describe('DIRECT_DOC_TOOLS', () => {
  it('应为单一收口工具且 schema 完整', () => {
    assert.equal(DIRECT_DOC_TOOLS.length, 1);
    assert.equal(DIRECT_DOC_TOOLS[0], WRITE_GENERATED_DOC_TOOL);
    assert.equal(WRITE_GENERATED_DOC_TOOL.name, 'write_generated_doc');
    assert.deepEqual(WRITE_GENERATED_DOC_TOOL.input_schema.required, ['file_name', 'content']);
  });
});
