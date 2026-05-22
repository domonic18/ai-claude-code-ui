#!/usr/bin/env node

/**
 * 协议翻译层测试套件（共享模块）
 *
 * 提供 5 项标准测试，用于验证 Anthropic ↔ OpenAI 协议翻译层的功能完整性。
 * 各翻译层脚本（OpenRouter / Claude Adapter / Claude Bridge）只需导入此模块并传递配置。
 *
 * 测试项：
 *   1. 基本对话        — Anthropic Messages API 格式能否正常响应
 *   2. 流式对话        — SSE 流式分块是否正确
 *   3. 工具调用（非流式）— 模型能否返回 tool_use
 *   4. 工具结果回传    — 多轮 tool_use → tool_result 循环是否完整
 *   5. 流式工具调用    — 流式 SSE 中 tool_use 块是否完整（核心风险项）
 *
 * 用法：
 *   import { runTestSuite } from './test-translation-suite.mjs';
 *   await runTestSuite({
 *     label: 'OpenRouter',
 *     baseURL: 'https://openrouter.ai/api/v1',
 *     apiKey: 'sk-or-v1-xxxxx',
 *     model: 'openai/gpt-5.5',
 *     needVPN: true,
 *   });
 */

// ============================================================
// 打印辅助
// ============================================================

function separator(title) {
  console.log();
  console.log('='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.log(`  ❌ ${msg}`);
}

function info(msg) {
  console.log(`  📝 ${msg}`);
}

function detail(label, value) {
  console.log(`     ${label}: ${String(value).slice(0, 300)}`);
}

// ============================================================
// HTTP 请求辅助
// ============================================================

/**
 * 发送非流式 Anthropic Messages API 请求
 */
async function callAnthropic(apiKey, body, baseURL) {
  const url = `${baseURL.replace(/\/+$/, '')}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

/**
 * 发送流式 Anthropic Messages API 请求
 * 返回: { chunks, fullText, toolUseStart, toolUseDelta }
 */
async function callAnthropicStream(apiKey, body, baseURL, debugSSE = false) {
  const url = `${baseURL.replace(/\/+$/, '')}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`流式 HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const result = { chunks: [], fullText: '', toolUseStart: null, toolUseDelta: '' };
  let currentEventType = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event: ')) {
        currentEventType = trimmed.slice(7).trim();
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        if (debugSSE) {
          console.log(`  [SSE event:${currentEventType}] ${data.slice(0, 200)}`);
        }

        try {
          const parsed = JSON.parse(data);
          result.chunks.push(parsed);

          if (parsed.type === 'content_block_start' &&
              parsed.content_block?.type === 'tool_use') {
            result.toolUseStart = parsed.content_block;
          }

          if (parsed.type === 'content_block_delta') {
            if (parsed.delta?.type === 'input_json_delta') {
              result.toolUseDelta += parsed.delta.partial_json || '';
            }
            if (parsed.delta?.text) {
              result.fullText += parsed.delta.text;
            }
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  }

  return result;
}

/**
 * 解析流式工具调用的完整 input
 */
function parseToolInput(streamResult) {
  if (streamResult.toolUseDelta) {
    try {
      return JSON.parse(streamResult.toolUseDelta);
    } catch {
      return streamResult.toolUseDelta;
    }
  }
  if (streamResult.toolUseStart?.input &&
      Object.keys(streamResult.toolUseStart.input).length > 0) {
    return streamResult.toolUseStart.input;
  }
  return null;
}

// ============================================================
// 5 项标准测试
// ============================================================

/**
 * 测试 1: 基本对话（非流式）
 */
async function testBasicChat({ key, baseURL, model }) {
  separator('测试 1: 基本对话（非流式）');

  const body = {
    model,
    max_tokens: 200,
    messages: [{ role: 'user', content: '用一句话回答：什么是 Claude Code？' }],
  };

  try {
    const result = await callAnthropic(key, body, baseURL);
    const textBlock = result.content?.find(b => b.type === 'text');
    const text = textBlock?.text || JSON.stringify(result.content);

    if (text && text.length > 0) {
      ok(`模型 ${model} 正常响应`);
      info(`回复: ${text.slice(0, 200)}`);
      info(`stop_reason: ${result.stop_reason}`);
      return true;
    }
    fail('响应内容为空');
    return false;
  } catch (err) {
    fail(`请求失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 2: 流式对话
 */
async function testStreamingChat({ key, baseURL, model }) {
  separator('测试 2: 流式对话');

  const body = {
    model,
    max_tokens: 200,
    messages: [{ role: 'user', content: '用一句话回答：1+1 等于几？' }],
  };

  try {
    const streamResult = await callAnthropicStream(key, body, baseURL);

    if (streamResult.chunks.length > 0 && streamResult.fullText.length > 0) {
      ok(`流式响应正常，共 ${streamResult.chunks.length} 个 chunk`);
      info(`拼接文本: ${streamResult.fullText.slice(0, 200)}`);

      const hasStart = streamResult.chunks.some(c => c.type === 'message_start');
      const hasStop = streamResult.chunks.some(c => c.type === 'message_stop');
      info(`message_start: ${hasStart ? '✅' : '❌'}`);
      info(`message_stop: ${hasStop ? '✅' : '❌'}`);
      return true;
    }

    fail('流式响应未收到有效内容');
    info(`chunks: ${streamResult.chunks.length}, text: ${streamResult.fullText.length} 字符`);
    return false;
  } catch (err) {
    fail(`流式请求失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 3: 工具调用（非流式）
 */
async function testToolCall({ key, baseURL, model }) {
  separator('测试 3: 工具调用（非流式）');

  const body = {
    model,
    max_tokens: 500,
    tools: [{
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: '温度单位' },
        },
        required: ['city'],
      },
    }],
    messages: [{ role: 'user', content: '北京今天天气怎么样？用工具查一下。' }],
  };

  try {
    const result = await callAnthropic(key, body, baseURL);
    const toolBlock = result.content?.find(b => b.type === 'tool_use');
    const textBlock = result.content?.find(b => b.type === 'text');

    if (toolBlock) {
      ok('模型成功返回工具调用 (tool_use)');
      detail('工具名称', toolBlock.name);
      detail('工具 ID', toolBlock.id);
      detail('工具参数', JSON.stringify(toolBlock.input));
      detail('stop_reason', result.stop_reason);

      if (textBlock) {
        info(`文字说明: ${textBlock.text.slice(0, 200)}`);
      }

      if (toolBlock.id && toolBlock.id.startsWith('toolu_')) {
        info(`ID 格式: Anthropic 原生格式 (${toolBlock.id})`);
      } else {
        info(`ID 格式: 非标准格式 (${toolBlock.id})`);
      }

      return true;
    }

    const text = textBlock?.text || '(无内容)';
    fail('模型未返回工具调用（纯文本回复）');
    info(`回复: ${text.slice(0, 300)}`);
    return false;
  } catch (err) {
    fail(`工具调用失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 4: 工具结果回传（多轮对话）
 * 关键风险点：Anthropic toolu_xxx ↔ OpenAI call_xxx ID 映射
 */
async function testToolResultRoundtrip({ key, baseURL, model }) {
  separator('测试 4: 工具结果回传（多轮对话）');

  const body = {
    model,
    max_tokens: 500,
    tools: [{
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: '温度单位' },
        },
        required: ['city'],
      },
    }],
    messages: [{ role: 'user', content: '北京今天天气怎么样？用工具查一下。' }],
  };

  try {
    // 第一轮：触发工具调用
    info('--- 第一轮: 触发工具调用 ---');
    const result1 = await callAnthropic(key, body, baseURL);
    const toolBlock = result1.content?.find(b => b.type === 'tool_use');

    if (!toolBlock) {
      fail('模型未返回工具调用，无法测试多轮对话');
      return false;
    }

    ok(`模型调用了 ${toolBlock.name}`);
    detail('tool_use_id', toolBlock.id);
    detail('工具参数', JSON.stringify(toolBlock.input));

    // 第二轮：回传工具结果
    info('--- 第二轮: 回传工具结果 ---');

    const toolResultContent = [{
      type: 'tool_result',
      tool_use_id: toolBlock.id,
      content: JSON.stringify({
        city: '北京', weather: '晴天', temperature: 25,
        unit: 'celsius', humidity: '40%',
      }),
    }];

    const body2 = {
      model,
      max_tokens: 300,
      messages: [
        { role: 'user', content: '北京今天天气怎么样？用工具查一下。' },
        { role: 'assistant', content: result1.content },
        { role: 'user', content: toolResultContent },
      ],
    };

    const result2 = await callAnthropic(key, body2, baseURL);
    const textBlock2 = result2.content?.find(b => b.type === 'text');

    if (textBlock2) {
      ok('工具结果回传成功，模型基于结果生成了回复');
      info(`回复: ${textBlock2.text.slice(0, 300)}`);
      info(`stop_reason: ${result2.stop_reason}`);
      return true;
    }

    const toolBlock2 = result2.content?.find(b => b.type === 'tool_use');
    if (toolBlock2) {
      ok('工具结果回传后模型继续调用了工具');
      detail('工具名称', toolBlock2.name);
      detail('工具参数', JSON.stringify(toolBlock2.input));
      return true;
    }

    fail('工具结果回传后模型未返回有效回复');
    detail('完整响应', JSON.stringify(result2.content).slice(0, 300));
    return false;
  } catch (err) {
    fail(`多轮工具调用失败: ${err.message}`);
    if (err.message.includes('400') || err.message.includes('tool_call')) {
      info('可能原因: 翻译层未正确维护 tool_use ID ↔ tool_call_id 映射关系');
    }
    return false;
  }
}

/**
 * 测试 5: 流式工具调用（核心风险项）
 * 验证 input_json_delta 在流式中是否完整
 */
async function testStreamingToolCall({ key, baseURL, model }) {
  separator('测试 5: 流式工具调用（风险项）');

  const body = {
    model,
    max_tokens: 500,
    tools: [{
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: '温度单位' },
        },
        required: ['city'],
      },
    }],
    messages: [{ role: 'user', content: '用工具查一下上海的天气。' }],
  };

  try {
    const streamResult = await callAnthropicStream(key, body, baseURL);

    if (streamResult.toolUseStart || streamResult.toolUseDelta) {
      const input = parseToolInput(streamResult);
      ok('流式工具调用成功');
      detail('工具名称', streamResult.toolUseStart?.name || '(通过 delta 获取)');
      detail('工具 ID', streamResult.toolUseStart?.id || '(通过 delta 获取)');
      detail('完整参数', JSON.stringify(input));
      detail('input_json_delta 长度', `${streamResult.toolUseDelta.length} 字符`);

      if (typeof input === 'object' && input !== null) {
        ok('工具参数 JSON 解析完整，无数据丢失');
      } else if (typeof input === 'string') {
        fail('工具参数未能完整解析为 JSON，可能存在数据丢失');
      }

      info(`chunks 总数: ${streamResult.chunks.length}`);
      return typeof input === 'object' && input !== null;
    }

    if (streamResult.fullText) {
      fail('流式响应仅返回文本，未触发工具调用');
      info(`文本: ${streamResult.fullText.slice(0, 200)}`);
      return false;
    }

    fail('流式响应未返回任何有效内容');
    return false;
  } catch (err) {
    fail(`流式工具调用失败: ${err.message}`);
    return false;
  }
}

// ============================================================
// 测试编排
// ============================================================

const TEST_NAMES = [
  '基本对话',
  '流式对话',
  '工具调用（非流式）',
  '工具结果回传（多轮）',
  '流式工具调用',
];

const TEST_FUNCTIONS = [
  testBasicChat,
  testStreamingChat,
  testToolCall,
  testToolResultRoundtrip,
  testStreamingToolCall,
];

/**
 * 对指定翻译层执行全部 5 项标准测试
 *
 * @param {object} config
 * @param {string} config.label     - 翻译层名称（如 "OpenRouter"）
 * @param {string} config.baseURL   - API 基础地址（如 "https://openrouter.ai/api/v1"）
 * @param {string} config.apiKey    - API 密钥
 * @param {string} config.model     - 模型名称（如 "openai/gpt-5.5"）
 * @param {boolean} [config.needVPN] - 是否需要 VPN（仅用于信息展示）
 * @param {boolean} [config.debugSSE] - 是否打印原始 SSE chunk
 * @param {string} [config.extraNote] - 额外提示信息
 * @returns {Promise<{passed: number, total: number, details: Array}>}
 */
export async function runTestSuite(config) {
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║     ${config.label.padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  info(`API 端点: ${config.baseURL}/messages`);
  info(`测试模型: ${config.model}`);
  info(`时间: ${new Date().toISOString()}`);
  if (config.needVPN) {
    console.log('  ⚠️  需要宿主机 VPN（Clash 等），且开启 Allow LAN');
  }
  if (config.extraNote) {
    console.log(`  📋 ${config.extraNote}`);
  }
  console.log();

  const apiKey = config.apiKey;
  info(`API Key: ${apiKey.slice(0, 12)}...`);

  // 可选健康检查
  try {
    const baseUrl = config.baseURL.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) info('健康检查通过 ✅');
  } catch {
    // 健康检查不是必需的
  }

  const results = [];
  const ctx = { key: apiKey, baseURL: config.baseURL, model: config.model };

  for (let i = 0; i < TEST_FUNCTIONS.length; i++) {
    const passed = await TEST_FUNCTIONS[i](ctx);
    results.push({ name: TEST_NAMES[i], passed });
  }

  // 汇总
  separator('验证结果汇总');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  console.log();
  console.log(`  通过: ${passed}/${total}`);
  console.log();

  if (passed === total) {
    console.log(`  ★ 结论: ${config.label} 翻译层 + GPT 模型所有测试通过！`);
    console.log('    该翻译层可用于生产环境。');
  } else if (passed >= 3) {
    console.log(`  ★ 结论: ${config.label} 基础功能通过，但流式/多轮工具调用存在翻译 Bug。`);
    console.log('    基本对话和工具调用（非流式）通过 → 基础翻译层可用');
    console.log('    流式/多轮工具调用失败 → 翻译层的流式实现有 Bug');
  } else {
    console.log(`  ★ 结论: ${config.label} 测试结果不理想，当前版本存在较多问题。`);
  }

  console.log();
  return { passed, total, details: results };
}

/**
 * 单独运行某项测试（用于调试）
 */
export async function runSingleTest(testIndex, config) {
  const ctx = { key: config.apiKey, baseURL: config.baseURL, model: config.model };
  return await TEST_FUNCTIONS[testIndex](ctx);
}

export { callAnthropic, callAnthropicStream, parseToolInput };
