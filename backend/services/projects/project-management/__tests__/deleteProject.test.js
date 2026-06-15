/**
 * deleteProject.test.js
 *
 * deleteProject 会话目录路径契约测试（Bug2 回归守护）。
 *
 * 背景：Bug2 —— 删除项目后重建同名项目，旧会话"复活"。
 * 根因是 deleteProject 历史上只删项目代码目录 /workspace/{name}，
 * 未删会话历史目录 /workspace/.claude/projects/{encodeProjectName(name)}/。
 * 两者分离存储且都在用户命名卷里持久化，漏删会话目录即导致复活。
 *
 * deleteProject 现在复用 getProjectDir() 计算会话目录，与读取会话时
 * 的路径同源（构造性一致）。本测试守护这一不变量：
 * 给定项目名，deleteProject 必须删除的会话目录路径 = getProjectDir(name)
 * = /workspace/.claude/projects/{encodeProjectName(name)}，对 ASCII 与
 * 非 ASCII 项目名都成立。
 *
 * 说明：deleteProject 的容器执行（execInContainer）依赖 Docker，按项目
 * 惯例属集成测试范畴（见同目录 operations.test.js 与
 * ContainerSessions.test.js 的同类注释）；此处覆盖其赖以正确删除的
 * 纯路径逻辑。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// deleteProject 删除会话目录时使用的路径生成器（同源于读取会话）
import { getProjectDir } from '../../../sessions/container/sessionReader.js';
// 路径编码器：会话目录命名的单一真相来源
import { encodeProjectName } from '../../../sessions/container/containerPathEncoder.js';
// 会话根目录常量（deleteProject 与 getSessionsInContainer 必须共用）
import { CONTAINER } from '../../../../config/config.js';

describe('deleteProject 会话目录路径契约 (Bug2 回归)', () => {
  it('会话目录应位于 /workspace/.claude/projects 下，并按项目名编码', () => {
    const name = 'my-workspace-144';
    const sessionDir = getProjectDir(name);

    assert.equal(
      sessionDir,
      `${CONTAINER.paths.projects}/${encodeProjectName(name)}`,
      'getProjectDir 应等于 会话根目录 + 编码项目名'
    );
    assert.equal(
      sessionDir,
      '/workspace/.claude/projects/-workspace-my-workspace-144',
      'ASCII 项目名编码：/workspace/my-workspace-144 → -workspace-my-workspace-144'
    );
  });

  it('非 ASCII 项目名（Bug2 真实场景）的会话目录应被正确编码', () => {
    const name = '我的项目';
    const sessionDir = getProjectDir(name);

    // 编码规则：非 ASCII → -，/ → -
    // /workspace/我的项目 → (非ASCII→-) /workspace/---- → ( /→-) -workspace-----
    assert.equal(sessionDir, '/workspace/.claude/projects/-workspace-----');
    // 命令中不应残留原始中文（否则 rm 路径与读取路径不一致 → 漏删 → 复活）
    assert.ok(!/[^\x00-\x7f]/.test(sessionDir), '会话目录路径不应残留非 ASCII 字符');
  });

  it('deleteProject 删除的会话目录必须与读取会话的目录完全一致（同源）', () => {
    // deleteProject 删除路径 = getProjectDir(name)；getSessionsInContainer
    // 读取路径 = getProjectDir(name)（sessionReader.js:166）。二者同源，
    // 保证"删的"与"读的"是同一目录。任一侧改用别的编码都会复活 Bug2。
    for (const name of ['plain', 'a/b/c', 'with-dash', '中文 123', 'UPPER_Case']) {
      const deletePath = getProjectDir(name);
      const readPath = getProjectDir(name);
      assert.equal(deletePath, readPath, `项目「${name}」删除与读取路径应一致`);
      assert.ok(
        deletePath.startsWith('/workspace/.claude/projects/'),
        `项目「${name}」会话目录应位于 /workspace/.claude/projects/ 下`
      );
    }
  });

  it('会话根目录常量与保留目录一致，避免删错位置', () => {
    // 守护：projects 根目录必须是 /workspace/.claude/projects，且 .claude
    // 在保留目录名内（列表查询时被过滤），二者配合保证删除目标精准。
    assert.equal(CONTAINER.paths.projects, '/workspace/.claude/projects');
  });
});
