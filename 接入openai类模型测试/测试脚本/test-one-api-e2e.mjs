#!/usr/bin/env node

/**
 * Claude-Adapter + One-API 端到端测试
 *
 * 模拟完整链路：Claude Agent SDK → Claude-Adapter → One-API → GPT 模型
 * 使用 Anthropic Messages API 协议（/v1/messages）发送请求，
 * 由 Claude-Adapter 翻译为 OpenAI 协议转发到 One-API。
 *
 * 前提条件：
 *   1. Claude-Adapter 已安装并启动（默认端口 3080）
 *      npm install -g claude-adapter
 *      claude-adapter
 *
 *   2. Claude-Adapter 上游已配置为 One-API 新加坡节点：
 *      Target URL: https://api.hk33smarter.com/v1
 *      API Key: sk-yH88...
 *
 * 用法：
 *   ADAPTER_BASE_URL=http://localhost:3080/v1 \
 *   ADAPTER_API_KEY=default-key \
 *   TEST_MODEL=gpt-5.2 \
 *   node 接入openai类模型测试/测试脚本/test-one-api-e2e.mjs
 *
 * 环境变量：
 *   ADAPTER_BASE_URL  - Claude-Adapter 地址（默认: http://localhost:3080/v1）
 *   ADAPTER_API_KEY   - Claude-Adapter API 密钥（默认: default-key）
 *   TEST_MODEL        - 测试模型名称（默认: gpt-5.2）
 *   TEST_DEBUG        - 设置后打印原始 SSE chunk
 */

import { runTestSuite } from './test-translation-suite.mjs';

const ADAPTER_BASE_URL = process.env.ADAPTER_BASE_URL || 'http://localhost:3080/v1';
const TEST_MODEL = process.env.TEST_MODEL || 'gpt-5.2';
const ADAPTER_API_KEY = process.env.ADAPTER_API_KEY || 'default-key';
const DEBUG_SSE = !!process.env.TEST_DEBUG;

async function main() {
  const result = await runTestSuite({
    label: 'Claude-Adapter + One-API 新加坡 (端到端)',
    baseURL: ADAPTER_BASE_URL,
    apiKey: ADAPTER_API_KEY,
    model: TEST_MODEL,
    debugSSE: DEBUG_SSE,
    extraNote: '链路: Claude SDK → Claude-Adapter(3080) → One-API(新加坡) → GPT',
  });

  console.log('  测试配置:');
  console.log(`    Claude-Adapter: ${ADAPTER_BASE_URL}`);
  console.log(`    模型: ${TEST_MODEL}`);
  console.log(`    上游: https://api.hk33smarter.com/v1`);
  console.log();

  process.exit(result.passed === result.total ? 0 : 1);
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
