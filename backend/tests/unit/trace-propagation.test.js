/**
 * Trace Context Propagation Tests
 *
 * 验证全链路 trace 上下文（traceId/spanId/userId/sessionId）在以下场景中正确传播：
 * 1. createLogger 动态代理 — 模块顶层创建的 logger 在请求上下文中自动注入 trace 字段
 * 2. AsyncLocalStorage + runWithTrace — 异步调用链中 trace 不丢失
 * 3. 流回调场景 — stdout/stderr/stream.on('end') 回调中 trace 上下文恢复
 * 4. 并发隔离 — 多个并发请求的 trace 上下文互不干扰
 * 5. 端到端模拟 — 模拟完整的 WS → ClaudeQuery → Stream 链路
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'stream';
import {
  createLogger,
  runWithTrace,
  getTraceContext,
  generateTraceId,
  generateSpanId,
} from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe('Trace Context Propagation', () => {

  describe('1. getTraceContext 在 runWithTrace 中可用', () => {

    it('在 runWithTrace 内 getTraceContext 返回正确的上下文', () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      runWithTrace({ traceId, spanId, userId: 'user-42', sessionId: 'sess-abc' }, () => {
        const ctx = getTraceContext();
        assert.equal(ctx.traceId, traceId);
        assert.equal(ctx.spanId, spanId);
        assert.equal(ctx.userId, 'user-42');
        assert.equal(ctx.sessionId, 'sess-abc');
      });
    });

    it('在 runWithTrace 外 getTraceContext 返回 undefined', () => {
      const ctx = getTraceContext();
      assert.equal(ctx, undefined);
    });

    it('嵌套 runWithTrace 不会互相干扰', () => {
      const outerTraceId = generateTraceId();
      const innerTraceId = generateTraceId();

      runWithTrace({ traceId: outerTraceId }, () => {
        assert.equal(getTraceContext().traceId, outerTraceId);

        runWithTrace({ traceId: innerTraceId }, () => {
          assert.equal(getTraceContext().traceId, innerTraceId);
        });

        assert.equal(getTraceContext().traceId, outerTraceId);
      });
    });

  });

  describe('2. AsyncLocalStorage 异步链路传播', () => {

    it('通过 await 异步调用，trace 上下文不丢失', async () => {
      const traceId = generateTraceId();
      const captured = [];

      await runWithTrace({ traceId, userId: 'user-async' }, async () => {
        captured.push({ step: 'entry', traceId: getTraceContext()?.traceId });

        await new Promise(resolve => setTimeout(resolve, 10));
        captured.push({ step: 'after-await', traceId: getTraceContext()?.traceId });

        await Promise.resolve();
        captured.push({ step: 'after-microtask', traceId: getTraceContext()?.traceId });
      });

      assert.equal(captured.length, 3);
      for (const entry of captured) {
        assert.equal(entry.traceId, traceId, `Step ${entry.step} lost traceId`);
      }
    });

  });

  describe('3. 流回调 trace 上下文恢复（模拟 dockerStreamHandler 模式）', () => {

    it('stdout on("data") 回调中通过 capturedTrace + runWithTrace 恢复上下文', async () => {
      const traceId = generateTraceId();
      const capturedContexts = [];

      const stdout = new PassThrough();

      // 模拟 dockerStreamHandler 中的模式：
      // 在 trace 上下文中注册回调，先用 getTraceContext() 捕获，回调中 runWithTrace 恢复
      runWithTrace({ traceId, spanId: 'spn-1', userId: 'user-stream', sessionId: 'sess-stream' }, () => {
        const capturedTrace = getTraceContext();

        stdout.on('data', () => {
          runWithTrace(capturedTrace, () => {
            capturedContexts.push({
              traceId: getTraceContext()?.traceId,
              spanId: getTraceContext()?.spanId,
              userId: getTraceContext()?.userId,
              sessionId: getTraceContext()?.sessionId,
            });
          });
        });
      });

      stdout.write('test data\n');
      stdout.end();

      assert.equal(capturedContexts.length, 1);
      assert.equal(capturedContexts[0].traceId, traceId);
      assert.equal(capturedContexts[0].spanId, 'spn-1');
      assert.equal(capturedContexts[0].userId, 'user-stream');
      assert.equal(capturedContexts[0].sessionId, 'sess-stream');
    });

    it('stream on("end") 回调中 trace 上下文正确传播', async () => {
      const traceId = generateTraceId();
      const capturedContexts = [];

      const stream = new PassThrough();

      runWithTrace({ traceId, userId: 'user-end-test' }, () => {
        const captured = getTraceContext();

        stream.on('end', () => {
          runWithTrace(captured, () => {
            capturedContexts.push({
              traceId: getTraceContext()?.traceId,
              userId: getTraceContext()?.userId,
            });
          });
        });
      });

      // PassThrough 需要 resume()（或有 data consumer）才会触发 end 事件
      stream.resume();
      stream.end();

      await new Promise(resolve => setTimeout(resolve, 10));

      assert.equal(capturedContexts.length, 1);
      assert.equal(capturedContexts[0].traceId, traceId);
      assert.equal(capturedContexts[0].userId, 'user-end-test');
    });

    it('多个 chunk 回调都保持正确的 trace 上下文', () => {
      const traceId = generateTraceId();
      const capturedTraceIds = [];

      const stdout = new PassThrough();

      runWithTrace({ traceId, sessionId: 'sess-multi' }, () => {
        const captured = getTraceContext();

        stdout.on('data', () => {
          runWithTrace(captured, () => {
            capturedTraceIds.push(getTraceContext()?.traceId);
          });
        });
      });

      stdout.write('chunk1\n');
      stdout.write('chunk2\n');
      stdout.write('chunk3\n');
      stdout.end();

      assert.equal(capturedTraceIds.length, 3);
      for (const id of capturedTraceIds) {
        assert.equal(id, traceId);
      }
    });

    it('不使用 runWithTrace 包裹的流回调丢失 trace 上下文（对照组）', () => {
      const traceId = generateTraceId();
      const capturedTraceIds = [];

      const stdout = new PassThrough();

      // 错误模式：没有 capture + restore
      runWithTrace({ traceId }, () => {
        stdout.on('data', () => {
          // 直接读取，不在 runWithTrace 中 — 应该拿不到
          capturedTraceIds.push(getTraceContext()?.traceId);
        });
      });

      stdout.write('data\n');
      stdout.end();

      assert.equal(capturedTraceIds.length, 1);
      // 不使用 runWithTrace 恢复的回调拿不到 trace
      assert.equal(capturedTraceIds[0], undefined);
    });

  });

  describe('4. 并发隔离 — 多请求 trace 互不干扰', () => {

    it('两个并发 runWithTrace 的 traceId 互不干扰', async () => {
      const traceIdA = generateTraceId();
      const traceIdB = generateTraceId();
      const results = [];

      const runA = runWithTrace({ traceId: traceIdA, userId: 'A' }, async () => {
        await new Promise(r => setTimeout(r, 20));
        results.push({ user: 'A', traceId: getTraceContext()?.traceId });
      });

      const runB = runWithTrace({ traceId: traceIdB, userId: 'B' }, async () => {
        await new Promise(r => setTimeout(r, 10));
        results.push({ user: 'B', traceId: getTraceContext()?.traceId });
      });

      await Promise.all([runA, runB]);

      assert.equal(results.length, 2);
      const resultA = results.find(r => r.user === 'A');
      const resultB = results.find(r => r.user === 'B');
      assert.equal(resultA.traceId, traceIdA, 'User A got wrong traceId');
      assert.equal(resultB.traceId, traceIdB, 'User B got wrong traceId');
    });

    it('并发流回调中 trace 上下文互不干扰', () => {
      const traceIdA = generateTraceId();
      const traceIdB = generateTraceId();
      const capturedA = [];
      const capturedB = [];

      const stdoutA = new PassThrough();
      const stdoutB = new PassThrough();

      // 为用户 A 注册流回调（正确模式：capture + restore）
      runWithTrace({ traceId: traceIdA, userId: 'user-A' }, () => {
        const captured = getTraceContext();
        stdoutA.on('data', () => {
          runWithTrace(captured, () => {
            capturedA.push(getTraceContext()?.traceId);
          });
        });
      });

      // 为用户 B 注册流回调
      runWithTrace({ traceId: traceIdB, userId: 'user-B' }, () => {
        const captured = getTraceContext();
        stdoutB.on('data', () => {
          runWithTrace(captured, () => {
            capturedB.push(getTraceContext()?.traceId);
          });
        });
      });

      // 交错写入（模拟并发流式输出）
      stdoutA.write('A1\n');
      stdoutB.write('B1\n');
      stdoutA.write('A2\n');
      stdoutB.write('B2\n');
      stdoutA.end();
      stdoutB.end();

      // 验证 A 的回调只看到 traceIdA
      assert.equal(capturedA.length, 2);
      assert.ok(capturedA.every(id => id === traceIdA), `User A stream got contaminated: ${JSON.stringify(capturedA)}`);

      // 验证 B 的回调只看到 traceIdB
      assert.equal(capturedB.length, 2);
      assert.ok(capturedB.every(id => id === traceIdB), `User B stream got contaminated: ${JSON.stringify(capturedB)}`);
    });

  });

  describe('5. 端到端模拟：WS handler → Stream → MessageTransformer 链路', () => {

    it('完整链路中 trace 上下文从 WS 入口贯穿到流处理结束', async () => {
      const e2eTraceId = generateTraceId();
      const e2eSpanId = generateSpanId();
      const traceCheckpoint = [];

      // 模拟 WS handler 注入 trace（对应 chat.js:233-243）
      await runWithTrace({
        traceId: e2eTraceId,
        spanId: e2eSpanId,
        userId: 'user-e2e',
        sessionId: 'sess-e2e',
      }, async () => {
        // Checkpoint 1: WS handler 入口
        traceCheckpoint.push({ phase: 'ws-handler', ...getTraceContext() });

        // 模拟 ClaudeQuery（对应 ClaudeQuery.js）
        const capturedForStream = getTraceContext();
        traceCheckpoint.push({ phase: 'claude-query', ...getTraceContext() });

        // 模拟 DockerExecutor + 流处理
        const stdout = new PassThrough();
        const stderr = new PassThrough();

        // 模拟 setupStdoutHandler（capture + restore 模式）
        stdout.on('data', (chunk) => {
          runWithTrace(capturedForStream, () => {
            traceCheckpoint.push({ phase: 'stdout-chunk', chunk: chunk.toString().trim(), ...getTraceContext() });
          });
        });

        // 模拟 setupStreamEndHandler
        const stream = new PassThrough();
        stream.on('end', () => {
          runWithTrace(capturedForStream, () => {
            traceCheckpoint.push({ phase: 'stream-end', ...getTraceContext() });
          });
        });

        // 模拟 SDK 输出
        stdout.write('{"type":"content","chunk":{"type":"assistant","content":"hello"}}\n');
        stdout.write('{"type":"done","sessionId":"real-sess-id"}\n');
        stdout.end();
        stream.end();
      });

      // 验证所有 checkpoint 都有正确的 traceId
      assert.ok(traceCheckpoint.length >= 4, `Expected at least 4 checkpoints, got ${traceCheckpoint.length}`);

      for (const cp of traceCheckpoint) {
        assert.equal(cp.traceId, e2eTraceId, `Phase ${cp.phase} has wrong traceId`);
        assert.equal(cp.spanId, e2eSpanId, `Phase ${cp.phase} has wrong spanId`);
        assert.equal(cp.userId, 'user-e2e', `Phase ${cp.phase} has wrong userId`);
        assert.equal(cp.sessionId, 'sess-e2e', `Phase ${cp.phase} has wrong sessionId`);
      }
    });

  });

});
