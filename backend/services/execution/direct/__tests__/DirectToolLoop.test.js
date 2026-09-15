/**
 * DirectToolLoop.test.js
 *
 * 直连受限工具回路单测：stream 注入（无网络），覆盖无工具单跳、工具往返
 * 回填形状、轮数上限、中止路由、执行异常降级、多 tool_use 单轮。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDirectConversation,
  extractToolUses,
  MAX_TOOL_ROUNDS,
} from '../DirectToolLoop.js';

/** 构造单跳流式结果 */
function hopResult(blocks) {
  return { contentBlocks: blocks, usage: { input_tokens: 1, output_tokens: 1 }, stopReason: 'end_turn' };
}

/** 构造 tool_use 块 */
function toolUseBlock(id, name, input) {
  return { type: 'tool_use', id, name, input };
}

/** 脚本化 stream：按序返回结果（耗尽后复用末项），记录每次请求参数 */
function scriptedStream(results, calls) {
  return async (config, request, handlers) => {
    calls.push({ request, handlers });
    return results[Math.min(calls.length - 1, results.length - 1)];
  };
}

/** 基础依赖（execTool 默认成功） */
function baseDeps(overrides = {}) {
  return {
    config: { baseURL: 'https://unit.test' },
    model: 'm',
    messages: [{ role: 'user', content: '生成文档' }],
    maxTokens: 100,
    execTool: async (tu) => ({ ok: true, echo: tu.name }),
    ...overrides,
  };
}

describe('extractToolUses', () => {
  it('应仅提取带 id 的 tool_use 块，容忍空入参', () => {
    const blocks = [
      { type: 'text', text: 'a' },
      { type: 'tool_use', id: 't1', name: 'n', input: {} },
      { type: 'tool_use', name: 'no-id' },
      null,
    ];
    assert.equal(extractToolUses(blocks).length, 1);
    assert.equal(extractToolUses(null).length, 0);
    assert.equal(extractToolUses([]).length, 0);
  });
});

describe('runDirectConversation', () => {
  it('模型不调用工具时单跳结束，请求体携带单一工具定义', async () => {
    const calls = [];
    const assistants = [];
    const { hops } = await runDirectConversation(baseDeps({
      stream: scriptedStream([hopResult([{ type: 'text', text: 'hi' }])], calls),
      onAssistant: (b) => assistants.push(b),
    }));
    assert.equal(calls.length, 1);
    assert.equal(hops.length, 1);
    assert.equal(hops[0].toolResults.length, 0);
    assert.deepEqual(assistants, [[{ type: 'text', text: 'hi' }]]);
    assert.equal(calls[0].request.tools.length, 1);
    assert.equal(calls[0].request.tools[0].name, 'write_generated_doc');
  });

  it('工具往返：assistant(tool_use) 与 user(tool_result) 依 Messages API 形状回填', async () => {
    const calls = [];
    const toolResults = [];
    const { hops } = await runDirectConversation(baseDeps({
      stream: scriptedStream([
        hopResult([toolUseBlock('t1', 'write_generated_doc', { file_name: 'a.md', content: 'x' })]),
        hopResult([{ type: 'text', text: '已生成' }]),
      ], calls),
      onToolResult: (tu, r) => toolResults.push({ tu, r }),
    }));
    assert.equal(calls.length, 2);
    assert.equal(hops.length, 2);

    // 第二次调用：原 user + assistant(tool_use) + user(tool_result) 共 3 条
    const msgs = calls[1].request.messages;
    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[1].role, 'assistant');
    assert.equal(msgs[1].content[0].type, 'tool_use');
    assert.equal(msgs[2].role, 'user');
    assert.equal(msgs[2].content[0].type, 'tool_result');
    assert.equal(msgs[2].content[0].tool_use_id, 't1');
    const parsed = JSON.parse(msgs[2].content[0].content);
    assert.equal(parsed.ok, true);

    assert.equal(hops[0].toolResults.length, 1);
    assert.equal(hops[0].toolResults[0].toolUseId, 't1');
    assert.equal(hops[1].toolResults.length, 0);
    assert.equal(toolResults.length, 1);
    assert.equal(toolResults[0].tu.name, 'write_generated_doc');
  });

  it('工具轮数达上限后忽略后续 tool_use 收尾（防失控）', async () => {
    assert.equal(MAX_TOOL_ROUNDS, 3);
    const calls = [];
    const { hops } = await runDirectConversation(baseDeps({
      // 脚本耗尽后复用末项：每次流式都返回 tool_use
      stream: scriptedStream([hopResult([toolUseBlock('t', 'write_generated_doc', {})])], calls),
    }));
    // 首跳 + 3 轮执行后的复核跳 = 4 次流式调用；第 4 跳仍返回 tool_use 但不再执行
    assert.equal(calls.length, MAX_TOOL_ROUNDS + 1);
    assert.equal(hops.length, MAX_TOOL_ROUNDS + 1);
    assert.equal(hops.filter(h => h.toolResults.length > 0).length, MAX_TOOL_ROUNDS);
    assert.equal(hops[hops.length - 1].toolResults.length, 0);
  });

  it('流返回 tool_use 后中止：不执行工具，抛 AbortError', async () => {
    const controller = new AbortController();
    const executed = [];
    const stream = async () => {
      controller.abort(); // 模拟流刚结束用户即按停止
      return hopResult([toolUseBlock('t1', 'write_generated_doc', {})]);
    };
    await assert.rejects(
      runDirectConversation(baseDeps({
        stream,
        signal: controller.signal,
        execTool: async (tu) => { executed.push(tu); return { ok: true }; },
      })),
      (err) => err.name === 'AbortError',
    );
    assert.equal(executed.length, 0);
  });

  it('中止信号在首轮前已置位：不发请求直接抛 AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    let called = 0;
    await assert.rejects(
      runDirectConversation(baseDeps({
        signal: controller.signal,
        stream: async () => { called++; return hopResult([]); },
      })),
      (err) => err.name === 'AbortError',
    );
    assert.equal(called, 0);
  });

  it('execTool 抛异常时降级为失败 tool_result 并继续回路', async () => {
    const calls = [];
    const { hops } = await runDirectConversation(baseDeps({
      stream: scriptedStream([
        hopResult([toolUseBlock('t1', 'write_generated_doc', {})]),
        hopResult([{ type: 'text', text: 'ok' }]),
      ], calls),
      execTool: async () => { throw new Error('容器写入失败'); },
    }));
    const tr = JSON.parse(calls[1].request.messages[2].content[0].content);
    assert.equal(tr.ok, false);
    assert.match(tr.error, /容器写入失败/);
    assert.equal(hops.length, 2);
  });

  it('execTool 返回非规范对象时归一为失败 tool_result', async () => {
    const calls = [];
    await runDirectConversation(baseDeps({
      stream: scriptedStream([
        hopResult([toolUseBlock('t1', 'write_generated_doc', {})]),
        hopResult([{ type: 'text', text: 'ok' }]),
      ], calls),
      execTool: async () => null,
    }));
    const tr = JSON.parse(calls[1].request.messages[2].content[0].content);
    assert.equal(tr.ok, false);
    assert.match(tr.error, /格式异常/);
  });

  it('单轮多个 tool_use 全部执行并逐个回填', async () => {
    const calls = [];
    const { hops } = await runDirectConversation(baseDeps({
      stream: scriptedStream([
        hopResult([
          toolUseBlock('t1', 'write_generated_doc', {}),
          toolUseBlock('t2', 'write_generated_doc', {}),
        ]),
        hopResult([{ type: 'text', text: 'done' }]),
      ], calls),
    }));
    assert.equal(hops[0].toolResults.length, 2);
    const resultBlocks = calls[1].request.messages[2].content;
    assert.equal(resultBlocks.length, 2);
    assert.deepEqual(resultBlocks.map(b => b.tool_use_id), ['t1', 't2']);
  });
});
