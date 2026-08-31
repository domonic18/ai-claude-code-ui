/**
 * SessionManager 清理定时器竞态测试
 *
 * 修复回归覆盖：每轮查询完成后 scheduleSessionCleanup 在旧 session 对象上
 * 挂 10s 定时器；用户在窗口内发送下一条消息时 createSession 会用新对象
 * 覆盖 Map 同 key 条目。修复前旧定时器未被取消，到点 abortSession 拿到的
 * 是新一轮会话，kill 其进程——表现为"AI 回复后 10 秒内发消息，新一轮被击杀"。
 *
 * @module tests/unit/session-manager-cleanup-timer
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSession,
  updateSession,
  scheduleSessionCleanup,
  cancelSessionCleanup,
  getSession,
  abortSession,
  setSessionKillFn,
} from '../../services/container/claude/SessionManager.js';

describe('SessionManager cleanup timer', () => {
  const sessionId = 'test-session-cleanup-timer';

  beforeEach(async () => {
    // 确保起点干净（abortSession 幂等，会话不存在时为 no-op）
    await abortSession(sessionId);
  });

  it('createSession 覆盖同 key 时应取消旧会话的清理定时器', async () => {
    // 第一轮：创建会话并标记完成，调度 10s 清理
    createSession(sessionId, { userId: 1, containerId: 'c1', command: 'first' });
    updateSession(sessionId, { status: 'completed' });
    scheduleSessionCleanup(sessionId, 10000);

    // 第二轮：用户在 10s 窗口内发新消息，createSession 覆盖同 key
    createSession(sessionId, { userId: 1, containerId: 'c1', command: 'second' });
    const fresh = getSession(sessionId);
    assert.ok(fresh);

    // 新会话对象不应携带旧定时器（undefined/null 均表示无活跃定时器，修复点）
    assert.ok(!fresh.cleanupTimer, `新会话不应残留清理定时器，实际为 ${fresh.cleanupTimer}`);

    // 显式取消 no-op 幂等
    cancelSessionCleanup(sessionId);

    // 新一轮注册 killFn 后正常 abort，不应被残留定时器干扰
    let killed = false;
    setSessionKillFn(sessionId, async () => { killed = true; });
    await abortSession(sessionId);
    assert.ok(killed);
    assert.strictEqual(getSession(sessionId), undefined);
  });

  it('旧定时器被取消后，覆盖创建的新会话在原定到点时间后仍存活', async () => {
    // 用短定时器模拟 10s 清理窗口：修复前旧定时器未被取消，
    // 到点 abortSession 会删除新一轮会话（真实场景还会 kill 新进程）
    createSession(sessionId, { userId: 1, containerId: 'c1', command: 'first' });
    updateSession(sessionId, { status: 'completed' });
    scheduleSessionCleanup(sessionId, 10);

    // 窗口内开启第二轮（覆盖同 key）
    createSession(sessionId, { userId: 1, containerId: 'c1', command: 'second' });

    // 越过旧定时器的到点时间：新会话不应被残留定时器 abort
    await new Promise(resolve => setTimeout(resolve, 30));
    const survivor = getSession(sessionId);
    assert.ok(survivor, '新会话不应被上一轮残留的清理定时器击杀');
    assert.strictEqual(survivor.command, 'second');

    await abortSession(sessionId);
  });

  it('cancelSessionCleanup 可取消已调度但未到点的清理', async () => {
    createSession(sessionId, { userId: 1, containerId: 'c1', command: 'cmd' });
    scheduleSessionCleanup(sessionId, 5);

    // 到点前取消，会话应保留
    cancelSessionCleanup(sessionId);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(getSession(sessionId), '会话不应在取消清理后被删除');

    await abortSession(sessionId);
  });
});
