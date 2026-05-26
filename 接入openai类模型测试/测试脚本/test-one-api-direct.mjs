#!/usr/bin/env node

/**
 * One-API 新加坡节点直连测试
 *
 * 直接用 OpenAI 协议（/v1/chat/completions）测试 One-API 端点，
 * 验证网络连通性、模型可用性、流式响应和 Tool Calling。
 *
 * 用法：
 *   ONE_API_BASE_URL=https://api.hk33smarter.com/v1 \
 *   ONE_API_KEY=sk-xxx \
 *   TEST_MODEL=gpt-5.2 \
 *   node 接入openai类模型测试/测试脚本/test-one-api-direct.mjs
 *
 * 环境变量：
 *   ONE_API_BASE_URL  - One-API 端点（默认: https://api.hk33smarter.com/v1）
 *   ONE_API_KEY       - API 密钥
 *   TEST_MODEL        - 测试模型（默认: gpt-5.2）
 *   TEST_DEBUG        - 设置后打印原始 SSE chunk
 */

// ============================================================
// 配置
// ============================================================

const BASE_URL = (process.env.ONE_API_BASE_URL || 'https://api.hk33smarter.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.ONE_API_KEY || '';
const MODEL = process.env.TEST_MODEL || 'gpt-5.2';
const DEBUG = !!process.env.TEST_DEBUG;

if (!API_KEY) {
  console.error('❌ 缺少 ONE_API_KEY 环境变量');
  process.exit(1);
}

// ============================================================
// 打印辅助
// ============================================================

function separator(title) {
  console.log();
  console.log('='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  📝 ${msg}`); }
function detail(label, value) {
  console.log(`     ${label}: ${String(value).slice(0, 300)}`);
}

// ============================================================
// 测试 0: 网络连通性 & DNS
// ============================================================

async function testConnectivity() {
  separator('测试 0: 网络连通性');

  const url = `${BASE_URL}/models`;
  const start = Date.now();

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;

    detail('端点', BASE_URL);
    detail('HTTP 状态', resp.status);
    detail('耗时', `${elapsed}ms`);

    if (resp.status === 401) {
      fail('认证失败（401），请检查 ONE_API_KEY');
      return false;
    }

    if (resp.ok || resp.status === 200) {
      ok(`连通正常，耗时 ${elapsed}ms`);
      return true;
    }

    fail(`非预期状态码: ${resp.status}`);
    return false;
  } catch (err) {
    fail(`连接失败: ${err.message}`);
    info('可能原因: 网络不通、DNS 解析失败、端点地址错误');
    return false;
  }
}

// ============================================================
// 测试 1: 模型列表
// ============================================================

async function testModelList() {
  separator('测试 1: 模型列表');

  try {
    const resp = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      fail(`请求失败: HTTP ${resp.status}`);
      return false;
    }

    const data = await resp.json();
    const models = data.data || [];
    const gptModels = models
      .map(m => m.id)
      .filter(id => /gpt|o[134]/i.test(id))
      .sort();

    ok(`共 ${models.length} 个模型，其中 GPT/OpenAI 系列 ${gptModels.length} 个`);
    info('重点模型:');
    const highlights = ['gpt-5.4', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'o3', 'o4-mini', 'gpt-4o'];
    for (const h of highlights) {
      const found = gptModels.filter(m => m.includes(h));
      if (found.length > 0) {
        detail(h, found.join(', '));
      }
    }

    // 检查测试模型是否在列表中
    const targetModel = gptModels.find(m => m === MODEL);
    if (targetModel) {
      ok(`测试模型 ${MODEL} 在列表中`);
    } else {
      const similar = gptModels.filter(m => m.includes(MODEL.split('-').slice(0, 2).join('-')));
      fail(`测试模型 ${MODEL} 未在列表中找到`);
      if (similar.length > 0) {
        info(`相近模型: ${similar.join(', ')}`);
      }
    }

    return true;
  } catch (err) {
    fail(`请求失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试 2: 基本对话（非流式）
// ============================================================

async function testBasicChat() {
  separator('测试 2: 基本对话（非流式）');

  const body = {
    model: MODEL,
    max_tokens: 100,
    messages: [{ role: 'user', content: '用一句话回答：1+1等于几？' }],
  };

  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      fail(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return false;
    }

    const data = await resp.json();
    const elapsed = Date.now() - start;
    const content = data.choices?.[0]?.message?.content || '';
    const finishReason = data.choices?.[0]?.finish_reason;
    const usage = data.usage;

    if (content.length > 0) {
      ok(`${MODEL} 正常响应，耗时 ${elapsed}ms`);
      info(`回复: ${content.slice(0, 200)}`);
      detail('finish_reason', finishReason);
      detail('usage', `prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, total=${usage?.total_tokens}`);
      return true;
    }

    fail('响应内容为空');
    return false;
  } catch (err) {
    fail(`请求失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试 3: 流式对话
// ============================================================

async function testStreamingChat() {
  separator('测试 3: 流式对话');

  const body = {
    model: MODEL,
    max_completion_tokens: 100,
    stream: true,
    messages: [{ role: 'user', content: '从1数到5，每个数字一行。' }],
  };

  const start = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      fail(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return false;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let chunkCount = 0;
    let hasRole = false;
    let hasFinish = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          hasFinish = true;
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          chunkCount++;
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.role) hasRole = true;
          if (delta?.content) fullText += delta.content;

          if (DEBUG && chunkCount <= 3) {
            info(`[chunk ${chunkCount}] ${JSON.stringify(delta).slice(0, 150)}`);
          }
        } catch {
          // 跳过不可解析的行
        }
      }
    }

    const elapsed = Date.now() - start;

    if (fullText.length > 0) {
      ok(`流式响应正常，${chunkCount} 个 chunk，耗时 ${elapsed}ms`);
      info(`拼接文本: ${fullText.slice(0, 200)}`);
      detail('包含 role delta', hasRole);
      detail('包含 [DONE]', hasFinish);
      return true;
    }

    fail('流式响应内容为空');
    detail('chunk 数', chunkCount);
    return false;
  } catch (err) {
    fail(`流式请求失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试 4: Tool Calling（非流式）
// ============================================================

async function testToolCall() {
  separator('测试 4: Tool Calling（非流式）');

  const body = {
    model: MODEL,
    max_tokens: 300,
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: '获取指定城市的天气信息',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名称' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['city'],
        },
      },
    }],
    messages: [{ role: 'user', content: '北京今天天气怎么样？用工具查一下。' }],
  };

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      fail(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return false;
    }

    const data = await resp.json();
    const message = data.choices?.[0]?.message;
    const toolCalls = message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const tc = toolCalls[0];
      ok('模型返回了 Tool Calling');
      detail('函数名', tc.function?.name);
      detail('tool_call ID', tc.id);
      detail('参数', tc.function?.arguments);
      detail('finish_reason', data.choices?.[0]?.finish_reason);

      // 验证参数可解析
      try {
        const args = JSON.parse(tc.function.arguments);
        if (args.city) {
          ok(`参数解析正常，city=${args.city}`);
        }
      } catch {
        fail('工具参数 JSON 解析失败');
      }

      return true;
    }

    const content = message?.content || '(无内容)';
    fail('模型未返回 Tool Calling（纯文本回复）');
    info(`回复: ${content.slice(0, 200)}`);
    return false;
  } catch (err) {
    fail(`Tool Calling 失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试 5: Tool Calling 多轮对话（结果回传）
// ============================================================

async function testToolResultRoundtrip() {
  separator('测试 5: Tool Calling 多轮对话（结果回传）');

  // 第一轮：触发工具调用
  info('--- 第一轮: 触发工具调用 ---');

  const body1 = {
    model: MODEL,
    max_tokens: 300,
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: '获取指定城市的天气信息',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名称' },
          },
          required: ['city'],
        },
      },
    }],
    messages: [{ role: 'user', content: '上海今天天气怎么样？用工具查。' }],
  };

  try {
    const resp1 = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body1),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp1.ok) {
      const text = await resp1.text();
      fail(`第一轮请求失败: HTTP ${resp1.status}: ${text.slice(0, 200)}`);
      return false;
    }

    const data1 = await resp1.json();
    const toolCalls = data1.choices?.[0]?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      fail('模型未返回工具调用，无法测试多轮');
      return false;
    }

    const tc = toolCalls[0];
    ok(`模型调用了 ${tc.function.name}`);
    detail('tool_call ID', tc.id);
    detail('参数', tc.function.arguments);

    // 第二轮：回传工具结果
    info('--- 第二轮: 回传工具结果 ---');

    const body2 = {
      model: MODEL,
      max_tokens: 300,
      tools: body1.tools,
      messages: [
        { role: 'user', content: '上海今天天气怎么样？用工具查。' },
        {
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        },
        {
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ city: '上海', weather: '多云', temperature: 22 }),
        },
      ],
    };

    const resp2 = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body2),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp2.ok) {
      const text = await resp2.text();
      fail(`第二轮请求失败: HTTP ${resp2.status}: ${text.slice(0, 200)}`);
      return false;
    }

    const data2 = await resp2.json();
    const content2 = data2.choices?.[0]?.message?.content || '';
    const finishReason2 = data2.choices?.[0]?.finish_reason;

    if (content2.length > 0) {
      ok('多轮 Tool Calling 成功，模型基于结果生成了回复');
      info(`回复: ${content2.slice(0, 300)}`);
      detail('finish_reason', finishReason2);
      return true;
    }

    fail('工具结果回传后模型未返回有效回复');
    detail('完整响应', JSON.stringify(data2.choices?.[0]).slice(0, 300));
    return false;
  } catch (err) {
    fail(`多轮 Tool Calling 失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试 6: 流式 Tool Calling
// ============================================================

async function testStreamingToolCall() {
  separator('测试 6: 流式 Tool Calling');

  const body = {
    model: MODEL,
    max_completion_tokens: 300,
    stream: true,
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: '获取指定城市的天气信息',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名称' },
          },
          required: ['city'],
        },
      },
    }],
    messages: [{ role: 'user', content: '用工具查一下深圳的天气。' }],
  };

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      fail(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return false;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let toolCallId = null;
    let functionName = '';
    let argsDelta = '';
    let textContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          chunkCount++;
          const delta = parsed.choices?.[0]?.delta;

          // 流式 tool_calls 格式: delta.tool_calls[0]
          if (delta?.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.id) toolCallId = tc.id;
            if (tc.function?.name) functionName += tc.function.name;
            if (tc.function?.arguments) argsDelta += tc.function.arguments;
          }
          if (delta?.content) textContent += delta.content;
        } catch {
          // 跳过
        }
      }
    }

    if (toolCallId || argsDelta) {
      ok('流式 Tool Calling 成功');
      detail('tool_call ID', toolCallId);
      detail('函数名', functionName);
      detail('参数 delta 长度', `${argsDelta.length} 字符`);

      // 尝试解析完整参数
      try {
        const args = JSON.parse(argsDelta);
        ok(`参数 JSON 解析完整: ${JSON.stringify(args)}`);
      } catch {
        fail('参数 JSON 解析失败，可能存在数据丢失');
        info(`原始 delta: ${argsDelta.slice(0, 300)}`);
      }

      detail('chunk 总数', chunkCount);
      return true;
    }

    if (textContent.length > 0) {
      fail('流式响应仅返回文本，未触发 Tool Calling');
      info(`文本: ${textContent.slice(0, 200)}`);
      return false;
    }

    fail('流式响应无有效内容');
    return false;
  } catch (err) {
    fail(`流式 Tool Calling 失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 主函数
// ============================================================

const TESTS = [
  { name: '网络连通性', fn: testConnectivity },
  { name: '模型列表', fn: testModelList },
  { name: '基本对话（非流式）', fn: testBasicChat },
  { name: '流式对话', fn: testStreamingChat },
  { name: 'Tool Calling（非流式）', fn: testToolCall },
  { name: 'Tool Calling 多轮（结果回传）', fn: testToolResultRoundtrip },
  { name: '流式 Tool Calling', fn: testStreamingToolCall },
];

async function main() {
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     One-API 新加坡节点 直连测试 (OpenAI 协议)          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  info(`端点: ${BASE_URL}`);
  info(`模型: ${MODEL}`);
  info(`Key: ${API_KEY.slice(0, 12)}...`);
  info(`时间: ${new Date().toISOString()}`);
  console.log();

  const results = [];
  for (const test of TESTS) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  // 汇总
  separator('测试结果汇总');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  console.log();
  console.log(`  通过: ${passed}/${total}`);
  console.log();

  if (passed === total) {
    console.log('  ★ 结论: One-API 新加坡节点所有测试通过！');
    console.log('    网络连通、模型可用、流式和 Tool Calling 均正常。');
    console.log('    可作为 Claude-Adapter 上游使用。');
  } else if (passed >= 4) {
    console.log('  ★ 结论: 基础功能通过，但部分高级功能存在问题。');
  } else {
    console.log('  ★ 结论: 测试不通过，请检查网络或 API Key。');
  }

  console.log();
  return { passed, total };
}

main()
  .then(({ passed, total }) => process.exit(passed === total ? 0 : 1))
  .catch(err => {
    console.error('脚本异常:', err);
    process.exit(1);
  });
