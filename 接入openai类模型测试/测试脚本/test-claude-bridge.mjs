#!/usr/bin/env node

/**
 * Claude Bridge × GPT 模型验证脚本
 *
 * 基于共享测试套件 test-translation-suite.mjs，对本地运行的 Claude Bridge
 * 协议翻译层执行 5 项标准测试。
 *
 * 前提：需要先启动 Claude Bridge 翻译代理
 *   npx claude-bridge -u https://api.laozhang.ai/v1 -k sk-密钥 -m gpt-4o -p 8080
 *
 * 用法：
 *   ADAPTER_BASE_URL=http://localhost:8080/v1 \
 *   ADAPTER_API_KEY=sk-any \
 *   TEST_MODEL=gpt-4o \
 *   node scripts/test-claude-bridge.mjs
 *
 * 环境变量：
 *   ADAPTER_BASE_URL    - Claude Bridge 地址（默认: http://localhost:8080/v1）
 *   ADAPTER_API_KEY     - Claude Bridge 的 API 密钥（默认: sk-any）
 *   TEST_MODEL          - 测试模型名称（默认: gpt-4o）
 */

import { runTestSuite } from './test-translation-suite.mjs';

const API_BASE_URL = process.env.ADAPTER_BASE_URL || 'http://localhost:8080/v1';
const TEST_MODEL = process.env.TEST_MODEL || 'gpt-4o';
const ADAPTER_API_KEY = process.env.ADAPTER_API_KEY || 'sk-any';

async function main() {
  const result = await runTestSuite({
    label: 'Claude Bridge × GPT',
    baseURL: API_BASE_URL,
    apiKey: ADAPTER_API_KEY,
    model: TEST_MODEL,
    extraNote: '需要先启动 Claude Bridge: npx claude-bridge -u <目标API> -k <密钥> -m <模型> -p 8080',
  });
  process.exit(result.passed === result.total ? 0 : 1);
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});
