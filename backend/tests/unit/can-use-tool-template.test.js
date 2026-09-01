/**
 * canUseToolTemplate 行为测试
 *
 * 核心回归保护：AskUserQuestion 回答注入协议（与 Claude CLI 0.3.252 对齐）。
 * 历史缺陷：注入顶层 answer 字段，CLI 不识别 → 模型收到 "did not answer" 重问一遍。
 *
 * 测法：把生成的回调代码串放进沙盒执行（动态 import 替换为 mock readline），
 * 模拟 stdin 消息流，验证三种回答模式产生的 PermissionResult。
 *
 * @module tests/unit/can-use-tool-template
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateCanUseToolCallback } from '../../services/container/claude/templates/canUseToolTemplate.js';

/** 模板中的动态 import 语句（沙盒中替换为 mock） */
const READLINE_IMPORT = "const readline = await import('readline');";

/**
 * 构造沙盒：执行生成的回调代码，返回可观测句柄
 * @param {string} code - generateCanUseToolCallback 输出的代码串
 * @param {object} [env] - 沙盒 process.env（默认带 AFK 超时，与容器一致）
 * @returns {object} {canUseTool, pendingAnswers, pushLine, logged}
 */
async function buildSandbox(code, env = { CLAUDE_AFK_TIMEOUT_MS: '300000' }) {
  const patched = code.replace(
    READLINE_IMPORT,
    'const readline = { createInterface: ({ input }) => ({ on: (ev, cb) => { input._lineCb = cb; } }) };'
  );
  assert.ok(!patched.includes('await import'), '模板中的动态 import 应已被 mock 替换');

  const logged = [];
  const fakeStdin = { resume: () => {}, _lineCb: null };
  const fakeConsole = {
    log: (s) => { try { logged.push(JSON.parse(s)); } catch { logged.push(String(s)); } },
    error: () => { },
  };

  const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
  // autoAnswer 模板没有 pendingAnswers（不需要等待 stdin），按存在性条件暴露
  const fn = new AsyncFunction(
    'process', 'console',
    patched + '\nreturn { canUseTool, ...(typeof pendingAnswers !== "undefined" ? { pendingAnswers } : {}) };'
  );
  const handle = await fn({ stdin: fakeStdin, env }, fakeConsole);

  return {
    handle,
    /** 模拟一行 stdin 输入（等价主容器写入容器 stdin） */
    pushLine: (obj) => fakeStdin._lineCb(JSON.stringify(obj)),
    /** SDK 通过 stdout 输出的结构化消息 */
    logged,
  };
}

describe('canUseToolTemplate - 交互模式（回答协议）', () => {
  let sandbox;

  beforeEach(async () => {
    sandbox = await buildSandbox(generateCanUseToolCallback(false));
  });

  it('text 模式：注入 updatedInput.response（不是 answer 顶层字段）', async () => {
    const promise = sandbox.handle.canUseTool(
      'AskUserQuestion',
      { questions: [{ question: '选哪个?' }] },
      { toolUseID: 'tu_1' }
    );

    // 提问应通过 stdout 输出
    const q = sandbox.logged.find((m) => m && m.type === 'agent-question');
    assert.ok(q, '应输出 agent-question 消息');
    assert.strictEqual(q.toolUseID, 'tu_1');

    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_1', mode: 'text', response: '授权优先版' });
    const result = await promise;

    assert.strictEqual(result.behavior, 'allow');
    assert.strictEqual(result.updatedInput.response, '授权优先版');
    assert.strictEqual(result.toolUseID, 'tu_1');
    // 回归断言：不得再注入 CLI 不识别的顶层 answer 字段
    assert.strictEqual(result.updatedInput.answer, undefined);
  });

  it('options 模式：注入 updatedInput.answers（问题文本→选项label 映射）', async () => {
    const promise = sandbox.handle.canUseTool(
      'AskUserQuestion',
      { questions: [{ question: '整体策略?' }] },
      { toolUseID: 'tu_2' }
    );

    sandbox.pushLine({
      type: 'user-answer', toolUseID: 'tu_2', mode: 'options',
      answers: { '整体策略?': '授权优先版（推荐）' }
    });
    const result = await promise;

    assert.strictEqual(result.behavior, 'allow');
    assert.deepStrictEqual(result.updatedInput.answers, { '整体策略?': '授权优先版（推荐）' });
    assert.strictEqual(result.updatedInput.answer, undefined);
  });

  it('skip 模式：返回 deny + declined 语义消息（任务继续）', async () => {
    const promise = sandbox.handle.canUseTool(
      'AskUserQuestion',
      { questions: [{ question: '继续吗?' }] },
      { toolUseID: 'tu_3' }
    );

    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_3', mode: 'skip' });
    const result = await promise;

    assert.strictEqual(result.behavior, 'deny');
    assert.strictEqual(result.message, 'User declined to answer questions');
    assert.strictEqual(result.toolUseID, 'tu_3');
  });

  it('旧协议 answer 字段：等价 text 模式注入 response（部署窗口兼容）', async () => {
    const promise = sandbox.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_4' });

    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_4', answer: '继续执行' });
    const result = await promise;

    assert.strictEqual(result.behavior, 'allow');
    assert.strictEqual(result.updatedInput.response, '继续执行');
  });

  it('多选 options：answers 值为逗号分隔的 label 串', async () => {
    const promise = sandbox.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_5' });

    sandbox.pushLine({
      type: 'user-answer', toolUseID: 'tu_5', mode: 'options',
      answers: { '启用哪些功能?': '功能A, 功能B' }
    });
    const result = await promise;

    assert.strictEqual(result.updatedInput.answers['启用哪些功能?'], '功能A, 功能B');
  });

  it('回答已失效的提问：输出 agent-answer-dropped 反馈', async () => {
    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_dead', mode: 'text', response: 'x' });

    const dropped = sandbox.logged.find((m) => m && m.type === 'agent-answer-dropped');
    assert.ok(dropped, '应输出 agent-answer-dropped');
    assert.strictEqual(dropped.reason, 'no_active_ask');
  });

  it('非 AskUserQuestion 工具直接放行', async () => {
    const result = await sandbox.handle.canUseTool('Read', { file_path: '/tmp/x' }, { toolUseID: 'tu_6' });
    assert.strictEqual(result.behavior, 'allow');
    assert.deepStrictEqual(result.updatedInput, { file_path: '/tmp/x' });
  });

  it('agent-question 携带 timeoutMs（读容器 env，与 CLI AFK 超时同源）', async () => {
    sandbox.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_env' });

    const q = sandbox.logged.find((m) => m && m.type === 'agent-question');
    assert.ok(q, '应输出 agent-question 消息');
    assert.strictEqual(q.timeoutMs, 300000);
  });

  it('env 未配置 CLAUDE_AFK_TIMEOUT_MS 时不输出 timeoutMs 字段（前端不显示倒计时）', async () => {
    const bare = await buildSandbox(generateCanUseToolCallback(false), {});
    bare.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_noenv' });

    const q = bare.logged.find((m) => m && m.type === 'agent-question');
    assert.ok(q, '应输出 agent-question 消息');
    assert.strictEqual('timeoutMs' in q, false);
  });

  it('env 配置非法值（非数字）时同样不输出 timeoutMs 字段', async () => {
    const bad = await buildSandbox(generateCanUseToolCallback(false), { CLAUDE_AFK_TIMEOUT_MS: 'abc' });
    bad.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_badenv' });

    const q = bad.logged.find((m) => m && m.type === 'agent-question');
    assert.ok(q, '应输出 agent-question 消息');
    assert.strictEqual('timeoutMs' in q, false);
  });
});

describe('canUseToolTemplate - bypassPermissions 自动回答', () => {
  it('自动回答注入 response 字段并通知前端', async () => {
    const sandbox = await buildSandbox(generateCanUseToolCallback(true));
    const result = await sandbox.handle.canUseTool('AskUserQuestion', { questions: [] }, { toolUseID: 'tu_auto' });

    assert.strictEqual(result.behavior, 'allow');
    assert.strictEqual(result.updatedInput.response, '继续');
    assert.strictEqual(result.updatedInput.answer, undefined);
    const notified = sandbox.logged.find((m) => m && m.type === 'agent-question-auto-answered');
    assert.ok(notified, '应通知前端已自动回答');
  });
});
