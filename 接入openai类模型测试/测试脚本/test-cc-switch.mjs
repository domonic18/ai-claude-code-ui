#!/usr/bin/env node

/**
 * CC Switch × GPT 模型验证脚本
 *
 * 基于共享测试套件 test-translation-suite.mjs，对 CC Switch 内置代理的
 * 协议翻译层执行 5 项标准测试。
 *
 * CC Switch: https://github.com/farion1231/cc-switch
 * CC Switch 是一个 Tauri 2 桌面 GUI 应用，内置 Local Proxy 功能：
 *   - Anthropic ↔ OpenAI 协议格式转换
 *   - 自动故障转移 (Failover)
 *   - 断路器 (Circuit Breaker)
 *   - Provider 健康监控
 *
 * 前提条件：
 *   1. 从 https://github.com/farion1231/cc-switch/releases 下载 macOS 版本
 *   2. 安装并启动 CC Switch 桌面应用
 *   3. 在 CC Switch GUI 中添加 Provider（如老张 API、OpenRouter 等）
 *   4. 启用 CC Switch 的 Local Proxy 功能
 *   5. 确认 CC Switch 代理监听的端口号（默认可能为 3030 或其他）
 *
 * 用法：
 *   CC_SWITCH_BASE_URL=http://localhost:3030/v1 \
 *   CC_SWITCH_API_KEY=你的密钥 \
 *   TEST_MODEL=gpt-4o \
 *   node workspace/测试设计/接入openai类模型测试/测试脚本/test-cc-switch.mjs
 *
 * 环境变量：
 *   CC_SWITCH_BASE_URL  - CC Switch 代理地址（默认: http://localhost:3030/v1）
 *   CC_SWITCH_API_KEY   - CC Switch 的 API 密钥（默认: sk-cc-switch）
 *   TEST_MODEL          - 测试模型名称（默认: gpt-4o）
 *   TEST_DEBUG          - 设置后打印原始 SSE chunk 用于调试
 */

import { runTestSuite } from './test-translation-suite.mjs';

const CC_SWITCH_BASE_URL = process.env.CC_SWITCH_BASE_URL || 'http://localhost:3030/v1';
const TEST_MODEL = process.env.TEST_MODEL || 'gpt-4o';
const CC_SWITCH_API_KEY = process.env.CC_SWITCH_API_KEY || 'sk-cc-switch';
const DEBUG_SSE = !!process.env.TEST_DEBUG;

async function main() {
  const result = await runTestSuite({
    label: 'CC Switch × GPT',
    baseURL: CC_SWITCH_BASE_URL,
    apiKey: CC_SWITCH_API_KEY,
    model: TEST_MODEL,
    debugSSE: DEBUG_SSE,
    extraNote: '需要先安装并启动 CC Switch GUI，在应用中配置 Provider 并启用 Local Proxy',
  });
  process.exit(result.passed === result.total ? 0 : 1);
}

main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});