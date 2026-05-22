/**
 * 跨 Provider 模型切换验证脚本
 *
 * 测试流程：
 * 1. 使用默认模型发一条消息（新会话）
 * 2. 切换到不同 provider 的模型发第二条消息（resume 会话）
 * 3. 检查 Docker 日志确认 provider 配置正确切换
 *
 * 用法: node scripts/test-cross-provider-switch.mjs
 */

import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  wsUrl: 'ws://localhost:3001',
  jwtSecret: 'kLcrsmO2gnj58NpjZ71nrYXpRgKpts6FMBzg6EuqehE=',
  userId: 1,  // admin
  username: 'admin',
  // 测试用的 model 序列
  // 注意：需要确保每个模型当前可用
  testModels: [
    { name: 'claude-sonnet-4-5-20250929-thinking', provider: 'Laozhang', label: '初始模型 (Laozhang Claude Sonnet 4-5)' },
    { name: 'claude-sonnet-4-6-thinking', provider: 'Laozhang', label: '同一 provider 切换 (Laozhang Sonnet 4-6)' },
    { name: 'gpt-5.5', provider: 'Claude Adapter', label: '跨 provider 切换 (Claude Adapter GPT-5.5)' },
    { name: 'kimi-k2.6', provider: 'Moonshot AI', label: '跨 provider 切换 (Moonshot AI Kimi K2.6)' },
  ]
};

// ============================================================
// 工具函数
// ============================================================

function generateToken() {
  return jwt.sign(
    { userId: CONFIG.userId, username: CONFIG.username },
    CONFIG.jwtSecret,
    { expiresIn: '1h' }
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(prefix, msg) {
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${time}] [${prefix}] ${msg}`);
}

// ============================================================
// WebSocket 测试客户端
// ============================================================

class TestClient {
  constructor() {
    this.token = generateToken();
    this.ws = null;
    this.sessionId = null;
    this.responses = [];
    this.done = false;
    this.error = null;
    this.connectionReady = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `${CONFIG.wsUrl}/ws?token=${this.token}`;
      log('CONNECT', `Connecting to ${url}`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        log('CONNECT', 'WebSocket connected');
        this.connectionReady = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.responses.push(msg);

          switch (msg.type) {
            case 'session_start':
              log('WS-RECV', `Session started: ${msg.sessionId}`);
              // 当前架构：ClaudeQuery.js 用 uuidv4() 生成 sessionId，
              // session_start 消息中的 sessionId 就是实际使用的 ID
              // (session-created 仅在 isTemporarySession 条件下发送，当前不会触发)
              if (msg.sessionId && !this.sessionId) this.sessionId = msg.sessionId;
              break;
            case 'session-created':
              log('WS-RECV', `Session created (SDK真实ID): ${msg.sessionId}`);
              // session-created 中的 sessionId 是 SDK 返回的真实 ID，优先使用
              // 优先级高于 session_start 中的 ID，因为它是磁盘会话文件的 ID
              if (msg.sessionId) this.sessionId = msg.sessionId;
              break;
            case 'memory-context':
              log('WS-RECV', `Memory context loaded (${msg.content?.length || 0} chars)`);
              break;
            case 'claude-response': {
              const sdkMsg = msg.data || {};
              const sdkType = sdkMsg.type || 'unknown';
              if (sdkType === 'result') {
                const result = sdkMsg.result || '';
                const preview = result.length > 120 ? result.slice(0, 120) + '...' : result;
                log('WS-RECV', `RESULT: ${preview.replace(/\n/g, ' ')}`);
              } else if (sdkType === 'assistant' || sdkType === 'message') {
                // 静默处理
              } else if (sdkType === 'content_block_delta' || sdkType === 'message_delta' || sdkType === 'content_block_stop') {
                // 静默处理
              } else if (sdkType === 'thinking') {
                log('WS-RECV', `[thinking: ${(sdkMsg.thinking || '').length} chars]`);
              } else {
                log('WS-RECV', `claude-response data.type=${sdkType}`);
              }
              break;
            }
            case 'claude-complete':
              log('WS-RECV', `Session complete: ${msg.sessionId} exitCode=${msg.exitCode}`);
              this.done = true;
              break;
            case 'claude-error':
              log('WS-RECV', `ERROR: ${msg.error || JSON.stringify(msg)}`);
              this.error = msg.error || 'SDK error';
              this.done = true;
              break;
            case 'error':
              log('WS-RECV', `ERROR: ${msg.message || msg.error}`);
              this.error = msg.message || msg.error;
              this.done = true;
              break;
            default:
              log('WS-RECV', `msg.type=${msg.type}`);
          }
        } catch (e) {
          log('WS-RECV', `Parse error: ${e.message}`);
        }
      });

      this.ws.on('close', (code, reason) => {
        log('CONNECT', `WebSocket closed: ${code} ${reason}`);
        this.connectionReady = false;
      });

      this.ws.on('error', (err) => {
        log('CONNECT', `WebSocket error: ${err.message}`);
        reject(err);
      });

      // 超时
      setTimeout(() => {
        if (!this.connectionReady) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  async sendCommand(model, message, resume = false) {
    if (!this.connectionReady) {
      throw new Error('WebSocket not connected');
    }

    // 等待前一个会话完成
    this.done = false;
    this.error = null;

    const payload = {
      type: 'claude-command',
      command: message,
      attachments: [],
      options: {
        projectPath: 'my-workspace',
        model: model,
        permissionMode: 'default',
        resume: resume,
      }
    };

    if (this.sessionId && resume) {
      payload.options.sessionId = this.sessionId;
    }

    log('SEND', `Sending command (model=${model}, resume=${resume}, sessionId=${payload.options.sessionId || 'new'})`);
    log('SEND', `Message: "${message}"`);

    this.ws.send(JSON.stringify(payload));

    // 等待完成
    const timeout = 300000; // 5 minutes per message
    const start = Date.now();
    while (!this.done && !this.error) {
      if (Date.now() - start > timeout) {
        log('TIMEOUT', `Timeout waiting for response (${timeout}ms)`);
        return { success: false, error: 'Timeout', sessionId: this.sessionId };
      }
      await sleep(500);
    }

    if (this.error) {
      log('RESULT', `FAIL: ${this.error}`);
      return { success: false, error: this.error, sessionId: this.sessionId };
    }

    // 更新 sessionId（优先从 session-created 获取 SDK 真实 ID，其次从 session_start 获取）
    const sessionCreatedMsg = this.responses.find(r => r.type === 'session-created');
    if (sessionCreatedMsg && sessionCreatedMsg.sessionId) {
      this.sessionId = sessionCreatedMsg.sessionId;
    } else if (!this.sessionId) {
      const sessionStartMsg = this.responses.find(r => r.type === 'session_start');
      if (sessionStartMsg && sessionStartMsg.sessionId) {
        this.sessionId = sessionStartMsg.sessionId;
      }
    }

    log('RESULT', `SUCCESS (sessionId=${this.sessionId})`);
    return { success: true, sessionId: this.sessionId };
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      await sleep(500);
    }
  }
}

// ============================================================
// Docker 日志检查
// ============================================================

async function checkDockerLogs(lines = 50) {
  try {
    const output = execSync(`docker logs claude-code-app --tail ${lines} 2>&1 | grep -E "(Provider config|modelName|providerBaseURL|ClaudeQuery|memory|Memory)" || true`, {
      encoding: 'utf-8',
      timeout: 5000
    });
    return output.trim();
  } catch (e) {
    return '(no matching logs)';
  }
}

// ============================================================
// 主测试流程
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  跨 Provider 模型切换验证');
  console.log('='.repeat(70) + '\n');

  const client = new TestClient();

  try {
    // 步骤 1: 连接 WebSocket
    log('TEST', 'Connecting WebSocket...');
    await client.connect();
    log('TEST', 'WebSocket connected successfully\n');

    // ============================================
    // 测试 1: 用默认模型建新会话
    // ============================================
    const test1 = CONFIG.testModels[0];
    log('TEST', `>>> 测试 1: 使用 ${test1.label} (${test1.name}) 创建新会话`);
    log('TEST', '='.repeat(50));

    let result = await client.sendCommand(test1.name, 'Say "Hello from model A" in one sentence', false);

    if (!result.success) {
      log('TEST', `测试 1 失败: ${result.error}`);
      await client.disconnect();
      process.exit(1);
    }

    const sessionId = result.sessionId;
    log('TEST', `测试 1 通过! 会话 ID: ${sessionId}\n`);

    // 等待一下确保日志写入
    await sleep(2000);

    // 检查 Docker 日志中 provider 配置
    log('TEST', '检查 Docker 日志 (测试 1 provider)...');
    const logs1 = await checkDockerLogs(100);
    if (logs1) {
      console.log(logs1.slice(0, 500));
    }

    // ============================================
    // 测试 2: 切换到不同 provider 的模型
    // ============================================
    const test2 = CONFIG.testModels[1];
    log('TEST', `\n>>> 测试 2: 切换到 ${test2.label} (${test2.name})，resume 会话`);
    log('TEST', '='.repeat(50));

    result = await client.sendCommand(test2.name, 'Continue: Model B here, say "Hello from model B" in one sentence', true);

    if (!result.success) {
      log('TEST', `测试 2 失败: ${result.error}`);
    } else {
      log('TEST', '测试 2 通过!\n');
    }

    await sleep(2000);

    // 检查 Docker 日志中 provider 切换
    log('TEST', '检查 Docker 日志 (测试 2 provider)...');
    const logs2 = await checkDockerLogs(200);
    if (logs2) {
      console.log(logs2.slice(0, 500));
    }

    // ============================================
    // 测试 3: 切换到 Claude Adapter (GPT)
    // ============================================
    const test3 = CONFIG.testModels[2];
    log('TEST', `\n>>> 测试 3: 切换到 ${test3.label} (${test3.name})，resume 会话`);
    log('TEST', '='.repeat(50));

    result = await client.sendCommand(test3.name, 'Continue: GPT model, say "Hello from model C" in one sentence', true);

    if (!result.success) {
      log('TEST', `测试 3 失败: ${result.error}`);
    } else {
      log('TEST', '测试 3 通过!\n');
    }

    await sleep(2000);

    log('TEST', '检查 Docker 日志 (测试 3 provider)...');
    const logs3 = await checkDockerLogs(300);

    // ============================================
    // 测试 4: 切回 Anthropic 模型
    // ============================================
    const test4 = CONFIG.testModels[3];
    log('TEST', `\n>>> 测试 4: 切回 ${test4.label} (${test4.name})，resume 会话`);
    log('TEST', '='.repeat(50));

    result = await client.sendCommand(test4.name, 'Continue: Back to Claude, say "Back to model D" in one sentence', true);

    if (!result.success) {
      log('TEST', `测试 4 失败: ${result.error}`);
    } else {
      log('TEST', '测试 4 通过!\n');
    }

    await sleep(2000);

    log('TEST', '检查 Docker 日志 (测试 4 provider)...');
    const logs4 = await checkDockerLogs(400);

    // ============================================
    // 汇总结果
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('  验证结果汇总');
    console.log('='.repeat(70));
    console.log(`  会话 ID: ${sessionId}`);
    console.log(`  测试模型序列:`);
    CONFIG.testModels.forEach((m, i) => {
      console.log(`    ${i+1}. ${m.label} (${m.name})`);
    });

    // 打印错误统计
    const errors = client.responses.filter(r => r.type === 'error');
    if (errors.length > 0) {
      console.log(`\n  错误: ${errors.length} 个`);
      errors.forEach(e => console.log(`    - ${e.message || e.error}`));
    } else {
      console.log('\n  ✓ 无错误');
    }

  } catch (e) {
    log('FATAL', `测试异常: ${e.message}`);
    console.error(e);
  } finally {
    await client.disconnect();
  }

  console.log('\n验证完成.\n');
}

main().catch(console.error);
