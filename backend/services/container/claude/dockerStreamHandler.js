/**
 * Docker Stream Processing Utilities
 *
 * Extracted stream handling logic from DockerExecutor.
 */

import { getSession } from './SessionManager.js';
import { SDK } from '../../../config/config.js';
import { processOutput } from './MessageTransformer.js';
import { recordSdkPerf, emitDeltaCadence } from './sdkPerfDiagnostics.js';
import { createLogger, runWithTrace, getTraceContext, startTimer } from '../../../utils/logger.js';

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
    /** @type {Function|null} Settle 前置钩子，用于清理资源（如结束计时器） */
    beforeSettle: null,
    settle(fn, value) {
      if (!this.settled) {
        this.settled = true;
        if (this.beforeSettle) this.beforeSettle();
        fn(value);
      }
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
  // 在注册时捕获当前 trace 上下文，以便在流回调中恢复
  const capturedTrace = getTraceContext();

  stdout.on('data', (chunk) => {
    runWithTrace(capturedTrace, () => {
      onChunk();
      const output = chunk.toString();
      chunks.push(output);

      if (writer) {
        try {
          // 动态解析 writer：刷新重连后 session.writer 已被新连接替换，
          // 优先取 SessionManager 中的最新 writer，使后续 chunk 转发到新连接；
          // 未注册时回退到闭包传入的 writer（ExecutionEngine 等旧路径兼容）。
          const activeWriter = getSession(sessionId)?.writer ?? writer;
          processOutput(output, activeWriter, sessionId, state);
        } catch (e) {
          logger.error({ sessionId, err: e, outputPreview: output.substring(0, 200) }, '[DockerExecutor] Error processing output');
        }
      } else {
        logger.warn('[DockerExecutor] Writer not available');
      }
    });
  });
}

/**
 * Setup stderr data handler
 * @param {object} stderr - stderr stream
 * @param {Array} chunks - Chunks array
 * @param {string} sessionId - Session ID
 */
function setupStderrHandler(stderr, chunks, sessionId) {
  // 在注册时捕获当前 trace 上下文，以便在流回调中恢复
  const capturedTrace = getTraceContext();
  // 容器内 SDK 脚本通过 [SDK_PERF] 喷出的时间戳（同源时钟，delta 有效）
  const perf = {};

  stderr.on('data', (chunk) => {
    runWithTrace(capturedTrace, () => {
      const stderrText = chunk.toString();
      chunks.push(stderrText);

      // 解析 [SDK_PERF] 标记并输出阶段 cost（此前被丢弃，是网关/模型延迟不可见的主因）
      for (const line of stderrText.split('\n')) {
        if (line.startsWith('[SDK_PERF]')) recordSdkPerf(perf, line, sessionId);
      }

      if (hasRealError(stderrText)) {
        logger.error({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR error detected');
      } else if (stderrText.startsWith('[SDK]')) {
        // SDK 脚本输出包含关键执行信息（permissionMode、model、chunk 等），INFO 级别确保生产环境可见
        logger.info({ sessionId, sdkLog: stderrText.substring(0, 500) }, '[DockerExecutor] SDK output');
      } else if (stderrText.includes('Error') || stderrText.includes('Exception')) {
        logger.debug({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR debug output');
      }
    });
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
 * @param {Function} getDataCount - Getter function returning current data chunk count
 */
function setupStreamEndHandler(ctx, stdoutChunks, stderrChunks, sessionId, getDataCount) {
  // 在注册时捕获当前 trace 上下文，以便在流回调中恢复
  const capturedTrace = getTraceContext();

  ctx.stream.on('end', () => {
    runWithTrace(capturedTrace, () => {
      // onDone 已主动 settle（done 消息触发的提前结束）后，忽略后续可能的 end 事件，避免冗余日志
      if (ctx.settled) return;

      if (ctx.timeoutHandle) clearTimeout(ctx.timeoutHandle);

      const session = getSession(sessionId);
      if (!session && getDataCount() > 0) {
        logger.info(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
        ctx.settle(ctx.resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
        return;
      }

      const stdoutOutput = stdoutChunks.join('');
      const stderrOutput = stderrChunks.join('');
      logger.info({ sessionId, totalChunks: getDataCount(), stdoutLength: stdoutOutput.length, stderrLength: stderrOutput.length }, '[DockerExecutor] Stream ended');

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
          totalChunks: getDataCount(),
        }, `[DockerExecutor] Abnormal termination: ${errorSource}`);
        ctx.settle(ctx.resolve, { output: stdoutOutput, sessionId, abnormalTermination: true, error: errorSource });
      } else {
        logger.info({ sessionId }, '[DockerExecutor] Execution completed successfully');
        ctx.settle(ctx.resolve, { output: stdoutOutput, sessionId });
      }
    });
  });
}

/**
 * Setup stream error handler
 * @param {object} ctx - Stream context
 * @param {string} sessionId - Session ID
 */
function setupStreamErrorHandler(ctx, sessionId) {
  // 在注册时捕获当前 trace 上下文，以便在流回调中恢复
  const capturedTrace = getTraceContext();

  ctx.stream.on('error', (err) => {
    runWithTrace(capturedTrace, () => {
      if (ctx.timeoutHandle) clearTimeout(ctx.timeoutHandle);
      logger.error({ sessionId, err }, '[DockerExecutor] Stream error');
      ctx.settle(ctx.reject, err);
    });
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
  const state = { sessionCreatedSent: false, toolSeq: 0, toolTimers: new Map(), onDone: null, apiCallSeq: 0, lastEventTime: null, deltas: [] };

  // TTFT (Time To First Token) 计时：从流处理开始到首个有效 stdout chunk
  const ttftTimer = startTimer('claude/first_token');
  // 流式输出计时：从首个 chunk 到 stream end（lazy 创建，首个 chunk 时启动）
  let streamDurationTimer = null;

  setupStdoutHandler(stdout, stdoutChunks, writer, sessionId, state, () => {
    dataCount++;
    // 首个 chunk 时记录 TTFT (Time To First Token)，同时启动 stream_duration 计时
    if (dataCount === 1) {
      ttftTimer.end(logger, 'First token received (TTFT)', { sessionId });
      streamDurationTimer = startTimer('claude/stream_duration');
    }
  });
  setupStderrHandler(stderr, stderrChunks, sessionId);

  return new Promise((resolve, reject) => {
    const context = createStreamContext(stream, stdout, stderr, resolve, reject);

    // 注册 settle 前置钩子：在流结束时结束 stream_duration 计时
    context.beforeSettle = () => {
      if (streamDurationTimer) {
        streamDurationTimer.end(logger, 'Stream duration ended', { sessionId, totalChunks: dataCount });
      }
      // 输出 partial delta 节奏摘要（判定网关是否真流式透传 SSE）
      emitDeltaCadence(state.deltas, sessionId, state.textDeltaCount || 0, state.thinkingDeltaCount || 0);
    };

    // SDK 输出 done 消息后进程往往不主动退出，导致 stream.on('end') 永远不来。
    // MessageTransformer 检测到 done 时回调此处，主动 settle 并释放 stream。
    state.onDone = () => {
      if (context.settled) return;
      const teardownTimer = startTimer('claude/teardown');
      if (context.timeoutHandle) clearTimeout(context.timeoutHandle);

      const stdoutOutput = stdoutChunks.join('');
      context.settle(context.resolve, { output: stdoutOutput, sessionId });

      // 销毁 stream 释放容器资源，否则 docker exec 一直挂到 timeout
      context.stdout.destroy();
      context.stderr.destroy();
      context.stream.destroy();

      teardownTimer.end(logger, 'Teardown completed', { sessionId, totalChunks: dataCount, stdoutLength: stdoutOutput.length });
    };

    setupExecutionTimeout(context, sessionId);
    setupStreamEndHandler(context, stdoutChunks, stderrChunks, sessionId, () => dataCount);
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
