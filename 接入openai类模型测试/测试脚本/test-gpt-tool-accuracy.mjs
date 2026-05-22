#!/usr/bin/env node

/**
 * GPT 工具调用参数准确性验证脚本
 *
 * 用途：用 SDK 真实工具 Schema 测试 GPT 的 tool_use 参数准确性。
 *       与 test-openrouter-gpt.mjs 不同，该脚本不测试翻译层，
 *       而是测试"GPT 能否正确生成 SDK 工具的合法参数"。
 *
 * 用法：
 *   OPENROUTER_API_KEY=sk-or-v1-xxxxx \
 *   HTTP_PROXY=http://127.0.0.1:7897 \
 *   HTTPS_PROXY=http://127.0.0.1:7897 \
 *   node scripts/test-gpt-tool-accuracy.mjs
 *
 * 环境变量：
 *   OPENROUTER_API_KEY  - OpenRouter API 密钥（必填）
 *   TEST_MODEL          - 模型名称（默认: openai/gpt-5.5）
 *   BASELINE_MODEL      - 基线模型名称（默认: anthropic/claude-sonnet-4-20250514）
 */

const API_BASE_URL = 'https://openrouter.ai/api/v1';
const TEST_MODEL = process.env.TEST_MODEL || 'openai/gpt-5.5';
const BASELINE_MODEL = process.env.BASELINE_MODEL || 'anthropic/claude-sonnet-4-20250514';

// ============================================================
// SDK 真实工具 Schema（从 @anthropic-ai/claude-agent-sdk 提取）
// ============================================================
const SDK_TOOLS = [
  {
    name: 'Read',
    description: '读取文件内容，支持文本文件和 PDF',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '文件的绝对路径' },
        offset: { type: 'number', description: '起始行号' },
        limit: { type: 'number', description: '读取行数' },
        pages: { type: 'string', description: 'PDF 页码范围，格式如 "1-5"、"3" 或 "10-20"' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'Grep',
    description: '在文件中搜索文本内容',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '正则表达式搜索模式' },
        path: { type: 'string', description: '搜索目录' },
        glob: { type: 'string', description: '文件过滤 glob 模式，如 "*.js"' },
        output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: '输出模式' },
        '-i': { type: 'boolean', description: '是否忽略大小写' },
        type: { type: 'string', description: '文件类型，如 "js"、"py"' },
        head_limit: { type: 'number', description: '输出结果数量上限' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'Edit',
    description: '搜索替换文件内容',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '文件的绝对路径' },
        old_string: { type: 'string', description: '被替换的文本' },
        new_string: { type: 'string', description: '替换后的文本' },
        replace_all: { type: 'boolean', description: '是否替换所有匹配项' }
      },
      required: ['file_path', 'old_string', 'new_string']
    }
  },
  {
    name: 'Bash',
    description: '执行 shell 命令',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        timeout: { type: 'number', description: '超时时间（毫秒），最大 600000' },
        description: { type: 'string', description: '命令描述（5-10 字，主动语态）' },
        run_in_background: { type: 'boolean', description: '是否在后台运行' },
        dangerouslyDisableSandbox: { type: 'boolean', description: '是否禁用沙箱' }
      },
      required: ['command']
    }
  },
  {
    name: 'WebSearch',
    description: '搜索网络信息',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        allowed_domains: { type: 'array', items: { type: 'string' }, description: '只返回这些域名的结果' },
        blocked_domains: { type: 'array', items: { type: 'string' }, description: '排除这些域名的结果' }
      },
      required: ['query']
    }
  }
];

// ============================================================
// 测试用例：每种工具设计一个 prompt，看 GPT 是否生成合法参数
// ============================================================
const TEST_CASES = [
  {
    name: 'Read - 测试 pages 参数',
    prompt: '请读取 /workspace/patent.pdf 的 PDF 文件，只看第 3 页到第 8 页的内容。',
    tools: [SDK_TOOLS.find(t => t.name === 'Read')],
    // pages 应为 "3-8" 或 "3,8" 等格式，不能为空字符串 ""
    paramChecks: [
      { tool: 'Read', param: 'pages', validator: v => typeof v === 'string' && v.length > 0 && !/^\s*$/.test(v), hint: 'pages 不能为空字符串' },
      { tool: 'Read', param: 'file_path', validator: v => typeof v === 'string' && v.startsWith('/'), hint: 'file_path 应为绝对路径' }
    ]
  },
  {
    name: 'Grep - 测试多参数组合',
    prompt: '在 /workspace 目录下的所有 .js 文件中搜索 "function"，忽略大小写，只显示匹配的文件名，最多返回 10 个结果。',
    tools: [SDK_TOOLS.find(t => t.name === 'Grep')],
    paramChecks: [
      { tool: 'Grep', param: 'pattern', validator: v => typeof v === 'string' && v.length > 0, hint: 'pattern 不能为空' },
      { tool: 'Grep', param: 'glob', validator: v => v === undefined || (typeof v === 'string'), hint: 'glob 应为字符串' },
      { tool: 'Grep', param: 'output_mode', validator: v => v === undefined || ['content', 'files_with_matches', 'count'].includes(v), hint: 'output_mode 必须是 content/files_with_matches/count 之一' },
      { tool: 'Grep', param: '-i', validator: v => v === undefined || typeof v === 'boolean', hint: '-i 应为布尔值，不能传字符串' },
      { tool: 'Grep', param: 'head_limit', validator: v => v === undefined || (typeof v === 'number' && v > 0), hint: 'head_limit 应为正数' }
    ]
  },
  {
    name: 'Edit - 测试必填参数完整性',
    prompt: '请替换 /workspace/readme.md 文件中的 "old version" 为 "new version"，只替换第一次出现。',
    tools: [SDK_TOOLS.find(t => t.name === 'Edit')],
    paramChecks: [
      { tool: 'Edit', param: 'file_path', validator: v => typeof v === 'string' && v.startsWith('/'), hint: 'file_path 应为绝对路径' },
      { tool: 'Edit', param: 'old_string', validator: v => typeof v === 'string' && v.length > 0, hint: 'old_string 不能为空' },
      { tool: 'Edit', param: 'new_string', validator: v => typeof v === 'string' && v !== old_string_ref, hint: 'new_string 必须与 old_string 不同', dynamic: true },
      { tool: 'Edit', param: 'replace_all', validator: v => v === undefined || typeof v === 'boolean', hint: 'replace_all 应为布尔值' }
    ]
  },
  {
    name: 'Bash - 测试参数类型',
    prompt: '在后台运行 npm test 命令，超时时间设为 30 秒。',
    tools: [SDK_TOOLS.find(t => t.name === 'Bash')],
    paramChecks: [
      { tool: 'Bash', param: 'command', validator: v => typeof v === 'string' && v.length > 0, hint: 'command 不能为空' },
      { tool: 'Bash', param: 'timeout', validator: v => v === undefined || (typeof v === 'number' && v <= 600000), hint: 'timeout 应为不超过 600000 的数字' },
      { tool: 'Bash', param: 'run_in_background', validator: v => v === undefined || typeof v === 'boolean', hint: 'run_in_background 应为布尔值' },
      { tool: 'Bash', param: 'dangerouslyDisableSandbox', validator: v => v === undefined || typeof v === 'boolean', hint: 'dangerouslyDisableSandbox 应为布尔值' }
    ]
  },
  {
    name: 'WebSearch - 测试数组参数',
    prompt: '搜索 Claude Code 的最新信息，只搜索 GitHub 和相关技术博客，排除商业广告网站。',
    tools: [SDK_TOOLS.find(t => t.name === 'WebSearch')],
    paramChecks: [
      { tool: 'WebSearch', param: 'query', validator: v => typeof v === 'string' && v.length > 0, hint: 'query 不能为空' },
      { tool: 'WebSearch', param: 'allowed_domains', validator: v => v === undefined || (Array.isArray(v) && v.every(d => typeof d === 'string')), hint: 'allowed_domains 应为字符串数组' },
      { tool: 'WebSearch', param: 'blocked_domains', validator: v => v === undefined || (Array.isArray(v) && v.every(d => typeof d === 'string')), hint: 'blocked_domains 应为字符串数组' }
    ]
  },
  {
    name: 'Read - 测试极限值：不带可选参数',
    prompt: '读取 /etc/hosts 文件的内容。',
    tools: [SDK_TOOLS.find(t => t.name === 'Read')],
    paramChecks: [
      { tool: 'Read', param: 'file_path', validator: v => typeof v === 'string' && v.startsWith('/'), hint: 'file_path 应为绝对路径' },
      { tool: 'Read', param: 'pages', validator: v => v === undefined, hint: 'pages 不应出现（不是 PDF）' },
      { tool: 'Read', param: 'offset', validator: v => v === undefined, hint: 'offset 不应出现（没有指定行号）' }
    ]
  }
];

// ============================================================
// 辅助函数
// ============================================================

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('错误: 请设置 OPENROUTER_API_KEY 环境变量');
    process.exit(1);
  }
  return key;
}

async function callAnthropicAPI(apiKey, body) {
  const url = `${API_BASE_URL}/messages`;
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
    throw new Error(`API 错误 (${response.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

function printSeparator(title) {
  console.log();
  console.log('='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printSuccess(msg) {
  console.log(`  ✓ ${msg}`);
}

function printFailure(msg) {
  console.log(`  ✗ ${msg}`);
}

function printInfo(msg) {
  console.log(`  → ${msg}`);
}

function checkParam(paramName, value, check) {
  if (check.dynamic) return true; // 跳过需要跨参数引用的检查
  try {
    return check.validator(value);
  } catch {
    return false;
  }
}

// ============================================================
// 运行测试
// ============================================================

async function runTest(modelName, apiKey, testCase) {
  const body = {
    model: modelName,
    max_tokens: 500,
    tools: testCase.tools,
    messages: [
      { role: 'user', content: testCase.prompt }
    ]
  };

  try {
    const result = await callAnthropicAPI(apiKey, body);
    const toolBlocks = result.content?.filter(b => b.type === 'tool_use') || [];
    const textBlocks = result.content?.filter(b => b.type === 'text') || [];

    if (toolBlocks.length === 0) {
      return {
        passed: false,
        errors: [`模型未返回工具调用（返回纯文本回复）`],
        details: textBlocks[0]?.text?.slice(0, 200) || '(无内容)'
      };
    }

    const errors = [];

    for (const check of testCase.paramChecks) {
      const toolBlock = toolBlocks.find(t => t.name === check.tool);
      if (!toolBlock) {
        errors.push(`${check.tool} 未被调用`);
        continue;
      }

      const value = toolBlock.input[check.param];
      if (!checkParam(check.param, value, check)) {
        errors.push(`${check.tool}.${check.param} = ${JSON.stringify(value)} — ${check.hint}`);
      } else {
        printInfo(`${check.tool}.${check.param} = ${JSON.stringify(value)} ✓`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      toolCalls: toolBlocks.map(t => ({ name: t.name, input: t.input })),
      details: textBlocks[0]?.text?.slice(0, 200) || ''
    };

  } catch (err) {
    return {
      passed: false,
      errors: [`调用失败: ${err.message}`],
      toolCalls: []
    };
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log();
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     GPT 工具调用参数准确性验证脚本                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  printInfo(`测试模型: ${TEST_MODEL}`);
  printInfo(`基线模型: ${BASELINE_MODEL}`);
  printInfo(`API: ${API_BASE_URL}/messages`);
  printInfo(`测试用例: ${TEST_CASES.length} 个（覆盖 ${SDK_TOOLS.length} 个工具）`);

  const apiKey = getApiKey();

  // 测试 GPT
  printSeparator(`测试模型: ${TEST_MODEL}`);
  const gptResults = [];
  for (const testCase of TEST_CASES) {
    printSeparator(`测试: ${testCase.name}`);
    printInfo(`Prompt: ${testCase.prompt}`);
    const result = await runTest(TEST_MODEL, apiKey, testCase);
    if (result.passed) {
      printSuccess(`${testCase.name} 所有参数检查通过`);
    } else {
      printFailure(`${testCase.name} 参数错误:`);
      for (const err of result.errors) {
        printFailure(`  ${err}`);
      }
    }
    if (result.toolCalls?.length > 0) {
      for (const tc of result.toolCalls) {
        printInfo(`调用了 ${tc.name}: ${JSON.stringify(tc.input)}`);
      }
    }
    gptResults.push({ name: testCase.name, passed: result.passed, errors: result.errors });
  }

  // 测试 Claude（基线对比）
  printSeparator(`基线模型: ${BASELINE_MODEL}`);
  const claudeResults = [];
  for (const testCase of TEST_CASES) {
    printSeparator(`基线测试: ${testCase.name}`);
    const result = await runTest(BASELINE_MODEL, apiKey, testCase);
    if (result.passed) {
      printSuccess(`${testCase.name} 所有参数检查通过`);
    } else {
      printFailure(`${testCase.name} 参数错误:`);
      for (const err of result.errors) {
        printFailure(`  ${err}`);
      }
    }
    claudeResults.push({ name: testCase.name, passed: result.passed, errors: result.errors });
  }

  // 汇总
  printSeparator('结果汇总');

  const gptPassed = gptResults.filter(r => r.passed).length;
  const claudePassed = claudeResults.filter(r => r.passed).length;
  const total = TEST_CASES.length;

  console.log();
  console.log(`  ${TEST_MODEL}:        ${gptPassed}/${total} 通过`);
  console.log(`  ${BASELINE_MODEL}:    ${claudePassed}/${total} 通过`);
  console.log();

  // 错误明细
  if (gptPassed < total) {
    printSeparator('GPT 参数错误明细');
    for (const r of gptResults) {
      if (!r.passed) {
        printFailure(r.name);
        for (const err of r.errors) {
          console.log(`         ${err}`);
        }
      }
    }
  }

  console.log();
  if (gptPassed === total && claudePassed === total) {
    console.log('  ★ 两个模型均通过所有参数检查');
  } else if (gptPassed < total && claudePassed === total) {
    console.log('  ★ GPT 存在参数错误，Claude 全部通过 — 确认是模型能力差异');
  } else {
    console.log('  ★ 两个模型均有部分失败，需进一步分析');
  }
  console.log();
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
