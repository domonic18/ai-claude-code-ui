/**
 * operations.test.js
 *
 * 项目管理操作单元测试：
 * - renameProject: 重命名项目显示名称（通过配置文件 I/O）
 *
 * 其他函数（deleteSession, isProjectEmpty, deleteProject, addProjectManually）
 * 依赖 Docker 容器操作，无法在纯单元测试中覆盖，需要集成测试环境。
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renameProject } from '../operations.js';
import { loadProjectConfig, saveProjectConfig } from '../../config/index.js';

/**
 * Helper: load config, run test with save/restore semantics
 * @param {Function} testFn - async (config) => void
 */
async function withFreshConfig(testFn) {
  const originalConfig = await loadProjectConfig();
  // Deep clone to avoid mutation
  const snapshot = JSON.parse(JSON.stringify(originalConfig));
  try {
    await testFn();
  } finally {
    await saveProjectConfig(snapshot);
  }
}

describe('operations - renameProject', () => {
  it('should set display name in project config', async () => {
    await withFreshConfig(async () => {
      const result = await renameProject('test-project', 'New Display Name');
      assert.equal(result, true);

      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'].displayName, 'New Display Name');
    });
  });

  it('should trim whitespace from display name', async () => {
    await withFreshConfig(async () => {
      await renameProject('test-project', '  Spaced Name  ');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'].displayName, 'Spaced Name');
    });
  });

  it('should remove config entry when display name is empty', async () => {
    await withFreshConfig(async () => {
      // First set a name
      const config = await loadProjectConfig();
      config['test-project'] = { displayName: 'Existing' };
      await saveProjectConfig(config);

      // Then clear it
      await renameProject('test-project', '');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'], undefined);
    });
  });

  it('should remove config entry when display name is whitespace only', async () => {
    await withFreshConfig(async () => {
      const config = await loadProjectConfig();
      config['test-project'] = { displayName: 'Existing' };
      await saveProjectConfig(config);

      await renameProject('test-project', '   ');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'], undefined);
    });
  });

  it('should not affect other project entries', async () => {
    await withFreshConfig(async () => {
      const config = await loadProjectConfig();
      config['other-project'] = { displayName: 'Keep This' };
      await saveProjectConfig(config);

      await renameProject('test-project', 'Test Name');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['other-project'].displayName, 'Keep This');
      assert.equal(updatedConfig['test-project'].displayName, 'Test Name');
    });
  });

  it('should overwrite existing display name', async () => {
    await withFreshConfig(async () => {
      const config = await loadProjectConfig();
      config['test-project'] = { displayName: 'Old Name' };
      await saveProjectConfig(config);

      await renameProject('test-project', 'New Name');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'].displayName, 'New Name');
    });
  });

  it('should handle project name with special characters', async () => {
    await withFreshConfig(async () => {
      await renameProject('my-project_v2.0', 'Special Name');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['my-project_v2.0'].displayName, 'Special Name');
    });
  });

  it('should handle unicode display names', async () => {
    await withFreshConfig(async () => {
      await renameProject('test-project', '测试项目');
      const updatedConfig = await loadProjectConfig();
      assert.equal(updatedConfig['test-project'].displayName, '测试项目');
    });
  });
});
