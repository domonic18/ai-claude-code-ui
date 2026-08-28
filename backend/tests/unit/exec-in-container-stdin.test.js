/**
 * execInContainer stdin/hijack 回归测试
 *
 * 背景：dockerode 4.x / docker-modem 5.x 下 exec.start 仅传 {stdin:true} 返回
 * HttpDuplex（chunked HTTP），daemon 不把请求体转发到 exec stdin——写入字节发出
 * 但容器内进程永远收不到（AskUserQuestion 回答黑洞）。必须同时传 hijack:true
 * 走 Connection: Upgrade 双向 TCP。此测试锁住该参数组合，防止依赖升级时回归。
 *
 * @module tests/unit/exec-in-container-stdin
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// mock ContainerConfigBuilder：避免真实 docker 依赖
import { execInContainer } from '../../services/container/core/ContainerOperations.js';

/** 构造记录 start 参数的假 docker 客户端 */
function makeFakeDocker(startBehavior = 'ok') {
  const calls = { execConfig: null, startOptions: null };
  const fakeStream = { on: () => {}, destroy: () => {} };
  const docker = {
    getContainer: () => ({
      exec: async (config) => {
        calls.execConfig = config;
        return {
          id: 'fake-exec-id',
          start: async (opts) => {
            calls.startOptions = opts;
            if (startBehavior === 'throw') throw new Error('start failed');
            return fakeStream;
          }
        };
      }
    })
  };
  return { docker, calls, fakeStream };
}

describe('execInContainer stdin hijack', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  it('传 stdin:true 时应同时传 hijack:true（修复：否则写入方向不可达）', async () => {
    const { docker, calls } = makeFakeDocker();

    await execInContainer(docker, 'container-id', ['node', 'script.mjs'], { stdin: true });

    assert.strictEqual(calls.startOptions.stdin, true);
    assert.strictEqual(calls.startOptions.hijack, true, 'stdin exec 必须走 hijack 双向流');
  });

  it('exec 配置应带 AttachStdin（daemon 侧打开 stdin）', async () => {
    const { docker, calls } = makeFakeDocker();

    await execInContainer(docker, 'container-id', ['node', 'script.mjs'], { stdin: true });

    assert.strictEqual(calls.execConfig.AttachStdin, true);
    assert.strictEqual(calls.execConfig.Tty, false);
  });

  it('无 stdin 的普通 exec 不启用 hijack（保持只读流行为不变）', async () => {
    const { docker, calls } = makeFakeDocker();

    await execInContainer(docker, 'container-id', ['echo', 'hi'], {});

    assert.strictEqual(calls.startOptions.stdin, false);
    assert.strictEqual(calls.startOptions.hijack, false, '普通 exec 不应改变现有流行为');
  });

  it('返回 exec 与 stream 供调用方使用', async () => {
    const { docker, fakeStream } = makeFakeDocker();

    const result = await execInContainer(docker, 'container-id', ['echo', 'hi'], {});

    assert.strictEqual(result.exec.id, 'fake-exec-id');
    assert.strictEqual(result.stream, fakeStream);
  });
});
