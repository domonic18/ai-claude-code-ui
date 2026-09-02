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

import { describe, it, beforeEach, mock } from 'node:test';
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

  it('agent-question 携带 timeoutMs（优先 QUESTION_AUTO_ANSWER_MS，兜底 CLAUDE_AFK env）', async () => {
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

describe('canUseToolTemplate - AFK 超时自动采用推荐选项', () => {
  /** 构造带自动采用 env 的沙盒（mock.timers 需在 canUseTool 调用前启用） */
  async function buildAutoSandbox() {
    return buildSandbox(generateCanUseToolCallback(false), {
      QUESTION_AUTO_ANSWER_MS: '300000',
      CLAUDE_AFK_TIMEOUT_MS: '360000'
    });
  }

  it('超时触发：自动采用推荐选项并输出 agent-question-auto-answered（reason:afk_timeout）', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildAutoSandbox();
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: '整体策略?', options: [
        { label: '授权优先版（推荐）' }, { label: '保守版' }
      ] }]
    }, { toolUseID: 'tu_afk_1' });

    mock.timers.tick(300000);
    const result = await promise;

    assert.strictEqual(result.behavior, 'allow');
    assert.deepStrictEqual(result.updatedInput.answers, { '整体策略?': '授权优先版（推荐）' });
    assert.strictEqual(result.toolUseID, 'tu_afk_1');
    const auto = sandbox.logged.find((m) => m && m.type === 'agent-question-auto-answered');
    assert.ok(auto, '应输出 agent-question-auto-answered');
    assert.strictEqual(auto.reason, 'afk_timeout');
    assert.deepStrictEqual(auto.answers, { '整体策略?': '授权优先版（推荐）' });

    // 自动采用后 pending 已消费：迟到的用户回答走 dropped 反馈，不再被误路由
    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_afk_1', mode: 'text', response: 'x' });
    assert.ok(sandbox.logged.some((m) => m && m.type === 'agent-answer-dropped'), '超时后到达的回答应被 dropped');
  });

  it('label 无"推荐"标注时取第一个选项', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildAutoSandbox();
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: '选哪个方案?', options: [{ label: '方案A' }, { label: '方案B' }] }]
    }, { toolUseID: 'tu_afk_2' });

    mock.timers.tick(300000);
    const result = await promise;

    assert.deepStrictEqual(result.updatedInput.answers, { '选哪个方案?': '方案A' });
  });

  it('multiSelect 多个推荐项全部采用（逗号 join，与手动多选协议一致）', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildAutoSandbox();
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: '启用哪些功能?', multiSelect: true, options: [
        { label: '检索（推荐）' }, { label: '导出（推荐）' }, { label: '统计' }
      ] }]
    }, { toolUseID: 'tu_afk_3' });

    mock.timers.tick(300000);
    const result = await promise;

    assert.strictEqual(result.updatedInput.answers['启用哪些功能?'], '检索（推荐）, 导出（推荐）');
  });

  it('回答窗口内用户先回答：定时器被清除，不触发自动采用', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildAutoSandbox();
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: '整体策略?', options: [{ label: '授权优先版（推荐）' }] }]
    }, { toolUseID: 'tu_afk_4' });

    mock.timers.tick(299999);
    sandbox.pushLine({ type: 'user-answer', toolUseID: 'tu_afk_4', mode: 'text', response: '手动回答' });
    const result = await promise;

    assert.strictEqual(result.updatedInput.response, '手动回答');
    // 定时器已清除：越过窗口后不再输出自动采用消息
    mock.timers.tick(600000);
    assert.strictEqual(
      sandbox.logged.find((m) => m && m.type === 'agent-question-auto-answered'),
      undefined,
      '用户已回答时不应自动采用'
    );
  });

  it('全部问题均无选项：降级 text 通道回复固定文案，保持任务连续性', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildAutoSandbox();
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: '继续吗?' }]
    }, { toolUseID: 'tu_afk_5' });

    mock.timers.tick(300000);
    const result = await promise;

    assert.strictEqual(result.behavior, 'allow');
    assert.strictEqual(result.updatedInput.response, '继续');
    assert.strictEqual(result.updatedInput.answers, undefined);
    const auto = sandbox.logged.find((m) => m && m.type === 'agent-question-auto-answered');
    assert.ok(auto);
    assert.strictEqual(auto.response, '继续');
  });

  it('env 缺失 QUESTION_AUTO_ANSWER_MS：不 arm 定时器（退化现状），timeoutMs 兜底 CLAUDE_AFK', async (t) => {
    t.after(() => mock.timers.reset());
    mock.timers.enable({ apis: ['setTimeout'] });
    const sandbox = await buildSandbox(generateCanUseToolCallback(false), { CLAUDE_AFK_TIMEOUT_MS: '360000' });
    const promise = sandbox.handle.canUseTool('AskUserQuestion', {
      questions: [{ question: 'x?', options: [{ label: 'A（推荐）' }] }]
    }, { toolUseID: 'tu_noauto' });

    // 兜底链：无 AUTO env 时 timeoutMs 取 CLAUDE_AFK 值
    const q = sandbox.logged.find((m) => m && m.type === 'agent-question');
    assert.strictEqual(q.timeoutMs, 360000);

    mock.timers.tick(600000);
    // 未 arm 定时器：promise 应仍挂起（setImmediate 未被 mock，可作真实异步探针）
    const stillPending = await Promise.race([
      promise.then(() => false, () => false),
      new Promise((resolve) => setImmediate(() => resolve(true))),
    ]);
    assert.ok(stillPending, '无 QUESTION_AUTO_ANSWER_MS 时不应自动结算');
    assert.strictEqual(
      sandbox.logged.find((m) => m && m.type === 'agent-question-auto-answered'),
      undefined
    );
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
