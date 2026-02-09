/**
 * Docker 执行引擎
 *
 * 负责在 Docker 容器内执行脚本并处理流式输出。
 */

import containerManager from '../core/index.js';
import { buildSDKScript } from './ScriptBuilder.js';
import { processOutput } from './MessageTransformer.js';
import { setSessionStream, getSession } from './SessionManager.js';
import { SDK } from '../../../config/config.js';

/**
 * 检查 stderr 是否包含真正的错误
 * @param {string} stderrOutput - stderr 输出
 * @returns {boolean} 是否包含错误
 */
function hasRealError(stderrOutput) {
  // 识别 Node.js 错误：SyntaxError, ReferenceError, TypeError 等
  // 但排除 SDK 的调试日志（以 "[SDK]" 开头）
  const errorPatterns = [
    /^(?!\[SDK\]).*Error:/m,      // 错误类型（但不是 [SDK] 日志）
    /^\s+at\s+/m,                  // 堆栈跟踪
    /process\.exit\(1\)/           // 进程退出
  ];
  
  return errorPatterns.some(pattern => pattern.test(stderrOutput));
}

/**
 * 在容器内执行 SDK 脚本
 * @param {string} userId - 用户 ID
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object>} 执行结果 { output, sessionId }
 */
export async function executeInContainer(userId, command, options, writer, sessionId) {
  console.log('[DockerExecutor] Starting execution');
  console.log('[DockerExecutor] userId:', userId);
  console.log('[DockerExecutor] command:', command);
  console.log('[DockerExecutor] cwd:', options.cwd);

  try {
    // 构建 SDK 脚本（传递 userId 以加载用户设置）
    console.log('[DockerExecutor] Building SDK script...');
    const sdkScript = await buildSDKScript(command, options, userId);
    console.log('[DockerExecutor] Script length:', sdkScript.length);

    // 记录环境变量状态
    console.log('[DockerExecutor] Host environment:');
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    console.log('[DockerExecutor] - ANTHROPIC_AUTH_TOKEN:',
      authToken ? `SET (${authToken.substring(0, 15)}...)` : 'NOT SET');
    console.log('[DockerExecutor] - ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL || 'NOT SET');
    console.log('[DockerExecutor] - ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL || 'NOT SET');

    // 验证必需的环境变量
    if (!authToken) {
      throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY must be set in environment or .env file');
    }
    
    // 在容器中执行
    const { stream, exec } = await containerManager.execInContainer(
      userId,
      sdkScript,
      {
        cwd: options.cwd || '/workspace',
        tty: false,  // 不使用 TTY，以便可以分离 stdout 和 stderr
        env: {
          NODE_PATH: '/app/node_modules',
          HOME: '/workspace',
          CLAUDE_CONFIG_DIR: '/workspace/.claude',
          ANTHROPIC_AUTH_TOKEN: authToken,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL
        }
      }
    );

    // 保存 stream 对象到会话，以便后续可以终止进程
    setSessionStream(sessionId, stream);

    console.log('[DockerExecutor] Execution started, stream:', !!stream, 'exec:', !!exec);

    // 收集输出
    const stdoutChunks = [];
    const stderrChunks = [];
    let dataCount = 0;

    // Docker exec stream 是多路复用的，需要分离 stdout 和 stderr
    const { PassThrough } = await import('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // 使用 Docker 的 modem.demuxStream 来分离
    const docker = containerManager.docker;
    console.log('[DockerExecutor] Demuxing stream...');
    docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve, reject) => {
      // 添加超时保护（可配置，0 表示禁用）
      const timeoutMs = SDK.executionTimeout;
      let timeoutHandle = null;
      let settled = false;  // 标志：Promise 是否已经 settle

      const settle = (fn, value) => {
        if (!settled) {
          settled = true;
          fn(value);
        }
      };

      if (timeoutMs > 0) {
        const timeoutMinutes = Math.round(timeoutMs / 60000);
        console.log(`[DockerExecutor] Setting execution timeout: ${timeoutMinutes} minutes`);
        timeoutHandle = setTimeout(() => {
          console.error(`[DockerExecutor] Execution timeout after ${timeoutMinutes} minutes`);
          stdout.destroy();
          stderr.destroy();
          stream.destroy();
          settle(reject, new Error(`SDK execution timeout (${timeoutMinutes} minutes)`));
        }, timeoutMs);
      } else {
        console.log('[DockerExecutor] Execution timeout disabled (SDK_EXECUTION_TIMEOUT=0)');
      }

      // 用于追踪会话创建
      const state = { sessionCreatedSent: false };
      
      // 监听 stdout（SDK 输出）
      stdout.on('data', (chunk) => {
        dataCount++;
        const output = chunk.toString();
        console.log(`[DockerExecutor] STDOUT #${dataCount}:`, output.substring(0, 100));
        stdoutChunks.push(output);

        // 通过 writer 发送到 WebSocket
        if (writer) {
          try {
            processOutput(output, writer, sessionId, state);
          } catch (e) {
            console.error('[DockerExecutor] Error processing output:', e);
          }
        } else {
          console.warn('[DockerExecutor] Writer not available');
        }
      });

      // 监听 stderr（错误和调试信息）
      stderr.on('data', (chunk) => {
        const errorMsg = chunk.toString();
        // 只输出可打印的调试日志，避免输出二进制数据污染日志
        if (errorMsg.startsWith('[SDK]') || errorMsg.includes('Error') || errorMsg.includes('Exception')) {
          console.error('[DockerExecutor] STDERR:', errorMsg.substring(0, 500));
        }
        stderrChunks.push(errorMsg);
      });

      // 监听流结束
      stream.on('end', () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // 检查会话是否被中止
        const session = getSession(sessionId);
        if (!session && dataCount > 0) {
          // 如果会话在 Map 中找不到，且已经有数据产生，可能是被 abortSession 删除了
          console.log(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
          settle(resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
          return;
        }

        const stdoutOutput = stdoutChunks.join('');
        const stderrOutput = stderrChunks.join('');

        console.log('[DockerExecutor] Stream ended. Total chunks:', dataCount);
        console.log('[DockerExecutor] STDOUT length:', stdoutOutput.length);
        console.log('[DockerExecutor] STDERR length:', stderrOutput.length);

        // 检查是否有真正的错误
        if (hasRealError(stderrOutput)) {
          console.error('[DockerExecutor] Execution failed:', stderrOutput);
          settle(reject, new Error(`SDK execution error: ${stderrOutput}`));
        } else {
          console.log('[DockerExecutor] Execution completed successfully');
          settle(resolve, { output: stdoutOutput, sessionId });
        }
      });

      stream.on('error', (err) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        console.error('[DockerExecutor] Stream error:', err);
        settle(reject, err);
      });
    });

  } catch (error) {
    console.error('[DockerExecutor] Exception:', error);
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

