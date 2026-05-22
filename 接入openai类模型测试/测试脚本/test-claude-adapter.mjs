#!/usr/bin/env node

/**
 * Claude Adapter × GPT 模型专项验证脚本
 *
 * 基于共享测试套件 test-translation-suite.mjs，对 Claude Adapter 协议翻译层
 * 执行 5 项标准测试。
 *
 * Claude Adapter: https://github.com/shantoislamdev/claude-adapter
 *
 * 前提条件：
 *   1. 安装并启动 Claude Adapter：
 *      npm install -g claude-adapter
 *      claude-adapter   # 交互式配置后会自动启动（默认端口 3080）
 *
 * 用法：
 *   ADAPTER_BASE_URL=http://localhost:3080 \
 *   ADAPTER_API_KEY=default-key \
 *   TEST_MODEL=gpt-4o \
 *   node scripts/test-claude-adapter.mjs
 *
 * 环境变量：
 *   ADAPTER_BASE_URL    - Claude Adapter 地址（默认: http://localhost:3080）
 *   ADAPTER_API_KEY     - Claude Adapter 的 API 密钥（默认: default-key）
 *   TEST_MODEL          - 测试模型名称（默认: gpt-4o）
 *   TEST_DEBUG          - 设置后打印原始 SSE chunk 用于调试
 */

import { runTestSuite } from './test-translation-suite.mjs';

const ADAPTER_BASE_URL = process.env.ADAPTER_BASE_URL || 'http://localhost:3080';
const TEST_MODEL = process.env.TEST_MODEL || 'gpt-4o';
const ADAPTER_API_KEY = process.env.ADAPTER_API_KEY || 'default-key';
const DEBUG_SSE = !!process.env.TEST_DEBUG;

async function main() {
  const result = await runTestSuite({
    label: 'Claude Adapter × GPT',
    baseURL: ADAPTER_BASE_URL,
    apiKey: ADAPTER_API_KEY,
    model: TEST_MODEL,
    debugSSE: DEBUG_SSE,
    extraNote: '需要先启动 Claude Adapter: npm install -g claude-adapter && claude-adapter',
  });
  process.exit(result.passed === result.total ? 0 : 1);
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
