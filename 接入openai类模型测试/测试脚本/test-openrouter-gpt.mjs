#!/usr/bin/env node

/**
 * OpenRouter GPT 模型快速验证脚本
 *
 * 基于共享测试套件 test-translation-suite.mjs，对 OpenRouter 的协议翻译层
 * 执行 5 项标准测试（基本对话、流式、工具调用、工具结果回传、流式工具调用）。
 *
 * 前提：宿主机需要 VPN（Clash 等），需开启 Allow LAN
 *
 * 用法：
 *   HTTP_PROXY=http://127.0.0.1:7897 \
 *   HTTPS_PROXY=http://127.0.0.1:7897 \
 *   OPENROUTER_API_KEY=sk-or-v1-xxxxx \
 *   node scripts/test-openrouter-gpt.mjs
 *
 * 环境变量：
 *   OPENROUTER_API_KEY  - OpenRouter API 密钥（必填）
 *   TEST_MODEL          - 模型名称（默认: openai/gpt-5.5）
 */

import { runTestSuite } from './test-translation-suite.mjs';

const API_BASE_URL = 'https://openrouter.ai/api/v1';
const TEST_MODEL = process.env.TEST_MODEL || 'openai/gpt-5.5';

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('错误: 请设置 OPENROUTER_API_KEY 环境变量');
    process.exit(1);
  }
  return key;
}

async function main() {
  const result = await runTestSuite({
    label: 'OpenRouter × GPT',
    baseURL: API_BASE_URL,
    apiKey: getApiKey(),
    model: TEST_MODEL,
    needVPN: true,
  });
  process.exit(result.passed === result.total ? 0 : 1);
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
