/**
 * ContainerOperations.test.js
 *
 * destroyContainer 单元测试，聚焦本次修复的 404 幂等行为：
 * - remove() 返回 404 → 视为幂等成功（容器已不存在，不再误报 ERROR）
 * - remove() 返回非 404 → 正常抛出（真实销毁失败不被吞掉）
 * - stop() 抛错 → 容错（已停止/已消失不影响后续 remove）
 * - 正常 stop + remove → 成功
 *
 * destroyContainer 接收 docker 客户端作为参数（依赖注入），
 * 故用普通 mock 对象即可，无需 mock 整个模块。
 *
 * @module services/container/__tests__/ContainerOperations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { destroyContainer } from '../core/ContainerOperations.js';

/**
 * 构造 mock docker 客户端
 * @param {Object} opts
 * @param {Error|Object|undefined} opts.stopThrows - stop() 抛出的错误（可选）
 * @param {Error|Object|undefined} opts.removeThrows - remove() 抛出的错误（可选）
 * @returns {Object} mock docker 客户端
 */
function makeMockDocker({ stopThrows, removeThrows } = {}) {
  return {
    getContainer: () => ({
      stop: async () => {
        if (stopThrows) throw stopThrows;
      },
      remove: async () => {
        if (removeThrows) throw removeThrows;
      },
    }),
  };
}

describe('ContainerOperations - destroyContainer', () => {
  it('should treat 404 from remove() as idempotent success', async () => {
    // 容器已被别处删除：remove 抛 404，不应冒泡为 ERROR（本次修复的核心）
    const docker = makeMockDocker({
      removeThrows: { statusCode: 404, message: 'no such container' },
    });

    await assert.doesNotReject(() =>
      destroyContainer(docker, 'container-id', '/data', 1, false)
    );
  });

  it('should rethrow non-404 error from remove()', async () => {
    // 真实销毁失败（如 500）必须暴露，不能被幂等逻辑吞掉
    const docker = makeMockDocker({
      removeThrows: { statusCode: 500, message: 'docker daemon error' },
    });

    await assert.rejects(
      () => destroyContainer(docker, 'container-id', '/data', 1, false),
      (err) => err.statusCode === 500
    );
  });

  it('should ignore stop() errors (already stopped or gone)', async () => {
    // stop 抛 404（容器已消失）不应影响后续 remove
    const docker = makeMockDocker({
      stopThrows: { statusCode: 404, message: 'no such container' },
    });

    await assert.doesNotReject(() =>
      destroyContainer(docker, 'container-id', '/data', 1, false)
    );
  });

  it('should succeed when stop and remove both complete', async () => {
    const docker = makeMockDocker();

    await assert.doesNotReject(() =>
      destroyContainer(docker, 'container-id', '/data', 1, false)
    );
  });
});
