/**
 * Claude SDK 容器集成
 *
 * Claude SDK 集成的容器化版本。
 * 在用户隔离的 Docker 容器内执行 Claude 命令。
 *
 * 主要特性：
 * - 容器隔离执行
 * - 支持中止的会话管理
 * - 流式输出处理
 * - WebSocket 消息流式传输
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import containerManager from './ContainerManager.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// 容器化查询的会话跟踪
const containerSessions = new Map();

/**
 * 在用户容器内执行 Claude SDK 查询
 * @param {string} command - 用户命令
 * @param {object} options - 执行选项
 * @param {object} writer - 用于流式传输的 WebSocket 写入器
 * @returns {Promise<string>} 会话 ID
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  console.log('[Container SDK] queryClaudeSDKInContainer called with command:', command);

  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  console.log('[Container SDK] Parsed options - userId:', userId, 'sessionId:', sessionId, 'isContainerProject:', isContainerProject, 'projectPath:', projectPath);

  try {
    // 1. 获取或创建用户容器
    console.log('[Container SDK] Getting or creating container for user:', userId);
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });
    console.log('[Container SDK] Container obtained:', container.id, container.name);

    // 2. 使用正确的工作目录构建 SDK 选项
    // 对于容器项目，使用 /home/node/.claude/projects/{projectPath}
    // 对于工作空间文件，使用 /workspace/{path}
    let workingDir;
    if (isContainerProject && projectPath) {
      // 容器项目：使用项目目录
      workingDir = `/home/node/.claude/projects/${projectPath}`;
    } else if (cwd) {
      // 工作空间文件：提取基本名称并使用 /workspace
      workingDir = `/workspace/${path.basename(cwd)}`;
    } else {
      workingDir = '/workspace';
    }

    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      cwd: workingDir,
      userId  // 确保 userId 被传递
    };

    console.log('[Container SDK] Mapped options:', JSON.stringify(mappedOptions));

    // 3. 创建会话信息
    const sessionInfo = {
      userId,
      sessionId,
      containerId: container.id,
      command,
      options: mappedOptions,
      startTime: Date.now(),
      status: 'running'
    };

    console.log('[Container SDK] Session info created, sessionId:', sessionId);
    containerSessions.set(sessionId, sessionInfo);

    // 4. 发送初始消息
    if (writer) {
      console.log('[Container SDK] Sending session_start message');
      writer.send({
        type: 'session_start',
        sessionId,
        containerId: container.id,
        message: 'Starting containerized Claude session...'
      });
    }

    // 5. 通过 node 脚本在容器中执行
    console.log('[Container SDK] Calling executeSDKInContainer...');
    const execResult = await executeSDKInContainer(
      container.id,
      command,
      mappedOptions,
      writer,
      sessionId
    );
    console.log('[Container SDK] executeSDKInContainer completed');

    // 6. 更新会话状态
    sessionInfo.status = 'completed';
    sessionInfo.endTime = Date.now();

    return sessionId;

  } catch (error) {
    // 出错时更新会话状态
    if (sessionId && containerSessions.has(sessionId)) {
      const session = containerSessions.get(sessionId);
      session.status = 'error';
      session.error = error.message;
      session.endTime = Date.now();
    }

    if (writer) {
      writer.send({
        type: 'error',
        sessionId,
        error: error.message
      });
    }

    throw error;
  }
}

/**
 * 在容器内执行 SDK 查询
 * @param {string} containerId - 容器 ID
 * @param {string} command - 要执行的命令
 * @param {object} options - SDK 选项
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object>} 执行结果
 */
async function executeSDKInContainer(containerId, command, options, writer, sessionId) {
  console.log('[Container SDK] executeSDKInContainer - Starting execution');
  console.log('[Container SDK] command:', command);
  console.log('[Container SDK] options.cwd:', options.cwd);
  console.log('[Container SDK] options.sessionId:', options.sessionId);

  try {
    // 构建 Node.js 脚本以在容器内运行 SDK
    console.log('[Container SDK] Building SDK script...');
    const sdkScript = buildSDKScript(command, options);
    console.log('[Container SDK] Script length:', sdkScript.length);
    console.log('[Container SDK] Script preview (first 200 chars):', sdkScript.substring(0, 200));

    // 在容器中执行
    console.log('[Container SDK] Calling containerManager.execInContainer...');
    console.log('[Container SDK] Host environment variables:');
    console.log('[Container SDK] - ANTHROPIC_AUTH_TOKEN:', process.env.ANTHROPIC_AUTH_TOKEN ? `SET (${process.env.ANTHROPIC_AUTH_TOKEN.substring(0, 15)}...)` : 'NOT SET');
    console.log('[Container SDK] - ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL || 'NOT SET');
    console.log('[Container SDK] - ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL || 'NOT SET');
    
    const { stream, exec } = await containerManager.execInContainer(
      options.userId,
      sdkScript,
      {
        cwd: options.cwd || '/workspace',
        tty: false,  // 不使用 TTY，以便可以分离 stdout 和 stderr
        env: {
          NODE_PATH: '/app/node_modules',
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL
        }
      }
    );
    console.log('[Container SDK] execInContainer returned, stream:', !!stream, 'exec:', !!exec);

    // 收集输出
    const stdoutChunks = [];
    const stderrChunks = [];
    let dataCount = 0;

    console.log('[Container SDK] Setting up stream listeners...');

    // Docker exec stream 是多路复用的，需要使用 PassThrough 来分离 stdout 和 stderr
    const { PassThrough } = await import('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // 使用 Docker 的 modem.demuxStream 来分离 stdout 和 stderr
    // 从 containerManager 获取 docker 实例
    const docker = containerManager.docker;
    
    console.log('[Container SDK] Demuxing stream...');
    docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve, reject) => {
      // 添加超时保护
      const timeout = setTimeout(() => {
        console.error('[Container SDK] Execution timeout after 5 minutes');
        stdout.destroy();
        stderr.destroy();
        stream.destroy();
        reject(new Error('SDK execution timeout'));
      }, 5 * 60 * 1000);

      // 用于追踪是否已发送 session-created
      let sessionCreatedSent = false;
      
      // 监听 stdout（SDK 输出）
      stdout.on('data', (chunk) => {
        dataCount++;
        const output = chunk.toString();
        console.log(`[Container SDK] STDOUT data #${dataCount}:`, output.substring(0, 100));
        stdoutChunks.push(output);

        // 如果 writer 可用，发送到 WebSocket
        // WebSocketWriter 的 send() 方法内部会检查 ws.readyState
        if (writer) {
          try {
            // 尝试解析为 JSON 以获得结构化输出
            const lines = output.split('\n').filter(line => line.trim());
            console.log(`[Container SDK] Processing ${lines.length} lines`);
            
            for (const line of lines) {
              const jsonData = tryParseJSON(line);
              if (jsonData) {
                // 检查是否是我们包装的数据格式
                if (jsonData.type === 'content' && jsonData.chunk) {
                  const sdkMessage = jsonData.chunk;
                  
                  // 从第一条消息捕获并发送 session-created
                  if (sdkMessage.session_id && !sessionCreatedSent && !sessionId) {
                    sessionCreatedSent = true;
                    console.log('[Container SDK] Sending session-created:', sdkMessage.session_id);
                    writer.send({
                      type: 'session-created',
                      sessionId: sdkMessage.session_id
                    });
                    
                    // 在 writer 上设置会话 ID
                    if (writer.setSessionId && typeof writer.setSessionId === 'function') {
                      writer.setSessionId(sdkMessage.session_id);
                    }
                  }
                  
                  // 提取实际的 SDK 消息并包装为 claude-response
                  console.log('[Container SDK] Sending claude-response with chunk type:', sdkMessage.type);
                  writer.send({
                    type: 'claude-response',
                    data: sdkMessage
                  });
                  
                  // 如果是 result 消息，也发送 token-budget
                  if (sdkMessage.type === 'result' && sdkMessage.modelUsage) {
                    const modelKey = Object.keys(sdkMessage.modelUsage)[0];
                    const modelData = sdkMessage.modelUsage[modelKey];
                    if (modelData) {
                      writer.send({
                        type: 'token-budget',
                        data: {
                          inputTokens: modelData.inputTokens || 0,
                          outputTokens: modelData.outputTokens || 0,
                          cacheReadInputTokens: modelData.cacheReadInputTokens || 0,
                          cacheCreationInputTokens: modelData.cacheCreationInputTokens || 0
                        }
                      });
                    }
                  }
                } else if (jsonData.type === 'done') {
                  // 发送 claude-complete 事件
                  console.log('[Container SDK] Sending claude-complete');
                  writer.send({
                    type: 'claude-complete',
                    sessionId: jsonData.sessionId || sessionId,
                    exitCode: 0
                  });
                } else if (jsonData.type === 'error') {
                  // 发送错误消息
                  console.error('[Container SDK] Sending claude-error:', jsonData.error);
                  writer.send({
                    type: 'claude-error',
                    error: jsonData.error
                  });
                }
              }
            }
          } catch (e) {
            console.error('[Container SDK] Error processing data:', e);
          }
        } else {
          console.warn('[Container SDK] Writer not available, data not sent!');
        }
      });

      // 监听 stderr（错误和调试信息）
      stderr.on('data', (chunk) => {
        const errorMsg = chunk.toString();
        console.error('[Container SDK] STDERR:', errorMsg);
        stderrChunks.push(errorMsg);
      });

      // 监听流结束
      stream.on('end', () => {
        clearTimeout(timeout);
        const stdoutOutput = stdoutChunks.join('');
        const stderrOutput = stderrChunks.join('');
        
        console.log('[Container SDK] Stream ended. Total data events:', dataCount);
        console.log('[Container SDK] STDOUT length:', stdoutOutput.length);
        console.log('[Container SDK] STDERR length:', stderrOutput.length);

        // 检查 stderr 中是否有真正的错误
        // 识别 Node.js 错误：SyntaxError, ReferenceError, TypeError 等
        // 但排除 SDK 的调试日志（以 "[SDK]" 开头）
        const errorPatterns = [
          /^(?!\[SDK\]).*Error:/m,      // 错误类型（但不是 [SDK] 日志）
          /^\s+at\s+/m,                  // 堆栈跟踪
          /process\.exit\(1\)/           // 进程退出
        ];
        
        const hasError = errorPatterns.some(pattern => pattern.test(stderrOutput));
        
        if (hasError) {
          console.error('[Container SDK] Execution failed with error:', stderrOutput);
          reject(new Error(`SDK execution error: ${stderrOutput}`));
        } else {
          console.log('[Container SDK] Resolving with output');
          resolve({ output: stdoutOutput, sessionId });
        }
      });

      stream.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Container SDK] Stream error event:', err);
        reject(err);
      });
    });

  } catch (error) {
    console.error('[Container SDK] Exception in executeSDKInContainer:', error);
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

/**
 * 构建 Node.js 脚本以执行 SDK 查询
 * @param {string} command - 要执行的命令
 * @param {object} options - SDK 选项
 * @returns {string} Node.js 脚本
 */
function buildSDKScript(command, options) {
  // 提取 sessionId 以便在脚本中使用
  const sessionId = options.sessionId || '';
  
  // 过滤并处理 options
  // 移除不需要传给 SDK 的字段
  const sdkOptions = { ...options };
  delete sdkOptions.userId;  // userId 不需要传给 SDK
  delete sdkOptions.isContainerProject;
  delete sdkOptions.projectPath;
  
  // 处理 model 参数：如果是 "custom"，则从环境变量读取，否则删除
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;  // 让 SDK 从环境变量读取
  }
  
  // 使用 base64 编码来避免转义问题
  const optionsJson = JSON.stringify(sdkOptions);
  const optionsBase64 = Buffer.from(optionsJson).toString('base64');
  
  // 转义命令中的单引号（因为我们使用单引号包裹脚本）
  const escapedCommand = command
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  // 使用单引号包裹脚本，避免双引号转义问题
  return `cd /app && node --input-type=module -e '
import { query } from "@anthropic-ai/claude-agent-sdk";

async function execute() {
  try {
    console.error("[SDK] Starting execution...");
    console.error("[SDK] Environment check:");
    console.error("[SDK] - ANTHROPIC_AUTH_TOKEN:", process.env.ANTHROPIC_AUTH_TOKEN ? "SET (" + process.env.ANTHROPIC_AUTH_TOKEN.substring(0, 10) + "...)" : "NOT SET");
    console.error("[SDK] - ANTHROPIC_BASE_URL:", process.env.ANTHROPIC_BASE_URL || "NOT SET (will use default)");
    console.error("[SDK] - ANTHROPIC_MODEL:", process.env.ANTHROPIC_MODEL || "NOT SET (will use default)");
    
    // 从 base64 解码 options
    const optionsJson = Buffer.from("${optionsBase64}", "base64").toString("utf-8");
    const options = JSON.parse(optionsJson);
    
    console.error("[SDK] Options:", JSON.stringify(options, null, 2));
    console.error("[SDK] Command:", "${escapedCommand}");
    
    // Claude SDK 接受一个对象参数：{ prompt, options }
    const result = query({
      prompt: "${escapedCommand}",
      options: options
    });
    console.error("[SDK] Query started, waiting for chunks...");

    let chunkCount = 0;
    for await (const chunk of result) {
      chunkCount++;
      console.error("[SDK] Received chunk #" + chunkCount);
      console.error("[SDK] Chunk type:", typeof chunk);
      console.error("[SDK] Chunk keys:", Object.keys(chunk || {}).join(", "));
      console.error("[SDK] Full chunk:", JSON.stringify(chunk, null, 2));
      
      // 输出 chunk 到 stdout 供前端接收
      console.log(JSON.stringify({
        type: "content",
        chunk: chunk
      }));
      
      if (chunk.sessionId) {
        console.error("[SDK] Session ID from chunk:", chunk.sessionId);
      }
    }

    console.error("[SDK] Query complete, total chunks:", chunkCount);
    console.log(JSON.stringify({
      type: "done",
      sessionId: "${sessionId}"
    }));

  } catch (error) {
    console.error("[SDK] Error occurred:", error.message);
    console.error("[SDK] Stack:", error.stack);
    console.error(JSON.stringify({
      type: "error",
      error: error.message,
      stack: error.stack
    }));
    process.exit(1);
  }
}

execute();
'`;
}

/**
 * 中止容器化 SDK 会话
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 如果会话已中止则返回 true
 */
export function abortClaudeSDKSessionInContainer(sessionId) {
  const session = containerSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';
  session.endTime = Date.now();

  // 注意：实际中止需要终止 exec 进程
  // 这是一个简化的实现
  containerSessions.delete(sessionId);

  return true;
}

/**
 * 检查容器化 SDK 会话是否活动
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 如果会话活动则返回 true
 */
export function isClaudeSDKSessionActiveInContainer(sessionId) {
  const session = containerSessions.get(sessionId);
  return session && session.status === 'running';
}

/**
 * 获取活动的容器化 SDK 会话
 * @returns {Array} 活动会话信息数组
 */
export function getActiveClaudeSDKSessionsInContainer() {
  return Array.from(containerSessions.values())
    .filter(session => session.status === 'running');
}

/**
 * 获取会话信息
 * @param {string} sessionId - 会话 ID
 * @returns {object|undefined} 会话信息
 */
export function getContainerSessionInfo(sessionId) {
  return containerSessions.get(sessionId);
}

/**
 * 尝试解析 JSON，如果无效则返回 null
 * @param {string} str - 要解析的字符串
 * @returns {object|null} 解析的对象或 null
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// 重新导出非容器化函数以保持向后兼容
export {
  abortClaudeSDKSessionInContainer as abortClaudeSDKSession,
  isClaudeSDKSessionActiveInContainer as isClaudeSDKSessionActive,
  getActiveClaudeSDKSessionsInContainer as getActiveClaudeSDKSessions
};
