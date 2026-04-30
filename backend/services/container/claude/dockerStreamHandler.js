/**
 * Docker Stream Processing Utilities
 *
 * Extracted stream handling logic from DockerExecutor.
 */

import { getSession } from './SessionManager.js';
import { SDK } from '../../../config/config.js';
import { processOutput } from './MessageTransformer.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/container/claude/dockerStreamHandler');

/** 异常终止诊断日志的最大截取长度 */
const DIAG_LOG_STDERR_MAX = 1000;
const DIAG_LOG_STDOUT_MAX = 500;

/**
 * Check if stderr contains real errors
 * @param {string} stderrOutput - stderr output
 * @returns {boolean} Whether it contains errors
 */
function hasRealError(stderrOutput) {
  const errorPatterns = [
    /^(?!\[SDK\]).*Error:/m,
    /^\s+at\s+/m,
    /process\.exit\(1\)/
  ];

  return errorPatterns.some(pattern => pattern.test(stderrOutput));
}

/**
 * Create stream processing context
 * @param {object} stream - Docker exec stream
 * @param {object} stdout - stdout PassThrough stream
 * @param {object} stderr - stderr PassThrough stream
 * @param {Function} resolve - Promise resolve
 * @param {Function} reject - Promise reject
 * @returns {object} Stream context
 */
function createStreamContext(stream, stdout, stderr, resolve, reject) {
  return {
    stream, stdout, stderr, resolve, reject,
    settled: false,
    timeoutHandle: null,
    settle(fn, value) {
      if (!this.settled) { this.settled = true; fn(value); }
    },
  };
}

/**
 * Setup stdout data handler
 * @param {object} stdout - stdout stream
 * @param {Array} chunks - Chunks array
 * @param {object} writer - WebSocket writer
 * @param {string} sessionId - Session ID
 * @param {object} state - State object
 * @param {Function} onChunk - Callback on chunk
 */
function setupStdoutHandler(stdout, chunks, writer, sessionId, state, onChunk) {
  stdout.on('data', (chunk) => {
    onChunk();
    const output = chunk.toString();
    chunks.push(output);

    if (writer) {
      try {
        processOutput(output, writer, sessionId, state);
      } catch (e) {
        logger.error({ sessionId, err: e, outputPreview: output.substring(0, 200) }, '[DockerExecutor] Error processing output');
      }
    } else {
      logger.warn('[DockerExecutor] Writer not available');
    }
  });
}

/**
 * Setup stderr data handler
 * @param {object} stderr - stderr stream
 * @param {Array} chunks - Chunks array
 * @param {string} sessionId - Session ID
 */
function setupStderrHandler(stderr, chunks, sessionId) {
  stderr.on('data', (chunk) => {
    const stderrText = chunk.toString();
    chunks.push(stderrText);

    if (hasRealError(stderrText)) {
      logger.error({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR error detected');
    } else if (stderrText.startsWith('[SDK]')) {
      // SDK 脚本输出包含关键执行信息（permissionMode、model、chunk 等），INFO 级别确保生产环境可见
      logger.info({ sessionId, sdkLog: stderrText.substring(0, 500) }, '[DockerExecutor] SDK output');
    } else if (stderrText.includes('Error') || stderrText.includes('Exception')) {
      logger.debug({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR debug output');
    }
  });
}

/**
 * Setup execution timeout protection
 * @param {object} ctx - Stream context
 * @param {string} sessionId - Session ID
 */
function setupExecutionTimeout(ctx, sessionId) {
  const timeoutMs = SDK.executionTimeout;
  if (timeoutMs <= 0) {
    logger.debug('[DockerExecutor] Execution timeout disabled (SDK_EXECUTION_TIMEOUT=0)');
    return;
  }

  const timeoutMinutes = Math.round(timeoutMs / 60000);
  logger.debug(`[DockerExecutor] Setting execution timeout: ${timeoutMinutes} minutes`);

  ctx.timeoutHandle = setTimeout(() => {
    logger.error(`[DockerExecutor] Execution timeout after ${timeoutMinutes} minutes`);
    ctx.stdout.destroy();
    ctx.stderr.destroy();
    ctx.stream.destroy();
    ctx.settle(ctx.reject, new Error(`SDK execution timeout (${timeoutMinutes} minutes)`));
  }, timeoutMs);
}

/**
 * Setup stream end handler
 * @param {object} ctx - Stream context
 * @param {Array} stdoutChunks - Stdout chunks
 * @param {Array} stderrChunks - Stderr chunks
 * @param {string} sessionId - Session ID
 * @param {number} dataCount - Data chunk count
 */
function setupStreamEndHandler(ctx, stdoutChunks, stderrChunks, sessionId, dataCount) {
  ctx.stream.on('end', () => {
    if (ctx.timeoutHandle) clearTimeout(ctx.timeoutHandle);

    const session = getSession(sessionId);
    if (!session && dataCount > 0) {
      logger.info(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
      ctx.settle(ctx.resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
      return;
    }

    const stdoutOutput = stdoutChunks.join('');
    const stderrOutput = stderrChunks.join('');
    logger.info({ sessionId, totalChunks: dataCount, stdoutLength: stdoutOutput.length, stderrLength: stderrOutput.length }, '[DockerExecutor] Stream ended');

    // 检查是否有 stderr 中的错误
    if (hasRealError(stderrOutput)) {
      logger.error({ sessionId, stderr: stderrOutput.substring(0, 2000) }, '[DockerExecutor] Execution failed');
      ctx.settle(ctx.reject, new Error(`SDK execution error: ${stderrOutput}`));
      return;
    }

    // 检查 stdout 中是否包含正常的 "done" 消息
    const hasDoneMessage = stdoutOutput.includes('"type":"done"');
    const hasStdoutError = stdoutOutput.includes('"type":"error"');

    if (!hasDoneMessage) {
      // 没有正常结束消息 = 异常终止
      // 尝试从 stdout 中解析错误信息（JSON.parse 比 regex 更可靠）
      let errorSource = 'process crashed or API connection lost';
      if (hasStdoutError) {
        try {
          // 从 stdout 末尾查找最后一个 error 类型的 JSON 行
          const lines = stdoutOutput.split('\n').filter(l => l.trim());
          for (let i = lines.length - 1; i >= 0; i--) {
            const parsed = JSON.parse(lines[i]);
            if (parsed.type === 'error' && parsed.error) {
              errorSource = parsed.error;
              break;
            }
          }
        } catch (parseErr) {
          logger.warn({ sessionId, parseErr: parseErr.message }, '[DockerExecutor] Failed to parse error from stdout');
          errorSource = 'unknown error (parse failed)';
        }
      }

      logger.error({
        sessionId,
        hasDoneMessage,
        hasStdoutError,
        stderrTail: stderrOutput.substring(stderrOutput.length - DIAG_LOG_STDERR_MAX),
        stdoutTail: stdoutOutput.substring(stdoutOutput.length - DIAG_LOG_STDOUT_MAX),
        totalChunks: dataCount,
      }, `[DockerExecutor] Abnormal termination: ${errorSource}`);
      ctx.settle(ctx.resolve, { output: stdoutOutput, sessionId, abnormalTermination: true, error: errorSource });
    } else {
      logger.info({ sessionId }, '[DockerExecutor] Execution completed successfully');
      ctx.settle(ctx.resolve, { output: stdoutOutput, sessionId });
    }
  });
}

/**
 * Setup stream error handler
 * @param {object} ctx - Stream context
 * @param {string} sessionId - Session ID
 */
function setupStreamErrorHandler(ctx, sessionId) {
  ctx.stream.on('error', (err) => {
    if (ctx.timeoutHandle) clearTimeout(ctx.timeoutHandle);
    logger.error({ sessionId, err }, '[DockerExecutor] Stream error');
    ctx.settle(ctx.reject, err);
  });
}

/**
 * Setup stream processing and return Promise result
 * @param {object} stream - Docker exec stream
 * @param {object} stdout - stdout PassThrough stream
 * @param {object} stderr - stderr PassThrough stream
 * @param {object} writer - WebSocket writer
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} Execution result
 */
function handleStreamProcessing(stream, stdout, stderr, writer, sessionId) {
  const stdoutChunks = [];
  const stderrChunks = [];
  let dataCount = 0;
  const state = { sessionCreatedSent: false, toolSeq: 0, toolTimers: new Map() };

  setupStdoutHandler(stdout, stdoutChunks, writer, sessionId, state, () => { dataCount++; });
  setupStderrHandler(stderr, stderrChunks, sessionId);

  return new Promise((resolve, reject) => {
    const context = createStreamContext(stream, stdout, stderr, resolve, reject);

    setupExecutionTimeout(context, sessionId);
    setupStreamEndHandler(context, stdoutChunks, stderrChunks, sessionId, dataCount);
    setupStreamErrorHandler(context, sessionId);
  });
}

export {
  createStreamContext,
  setupStdoutHandler,
  setupStderrHandler,
  setupExecutionTimeout,
  setupStreamEndHandler,
  setupStreamErrorHandler,
  handleStreamProcessing
};
