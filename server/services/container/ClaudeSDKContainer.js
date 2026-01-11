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
  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  try {
    // 1. 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });

    // 2. 确定工作目录 - 容器中使用 /workspace 作为根目录
    const workingDir = '/workspace';
    console.log(`[Container SDK] Using workspace directory: ${workingDir}`);

    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      cwd: workingDir
    };

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

    containerSessions.set(sessionId, sessionInfo);

    // 4. 发送初始消息
    if (writer) {
      writer.send({
        type: 'session_start',
        sessionId,
        containerId: container.id,
        message: 'Starting containerized Claude session...'
      });
    }

    // 5. 通过 node 脚本在容器中执行
    const execResult = await executeSDKInContainer(
      container.id,
      command,
      mappedOptions,
      writer,
      sessionId
    );

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
  try {
    console.log('[Container SDK] Starting execution in container:', containerId);
    console.log('[Container SDK] Command:', command);
    console.log('[Container SDK] Options:', JSON.stringify(options));

    // 构建 Node.js 脚本以在容器内运行 SDK
    const sdkScript = buildSDKScript(command, options);
    console.log('[Container SDK] Script length:', sdkScript.length);

    // 在容器中执行
    console.log('[Container SDK] Executing in container...');
    const { stream, exec } = await containerManager.execInContainer(
      options.userId,
      sdkScript,
      {
        cwd: options.cwd || '/workspace',
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL
        }
      }
    );
    console.log('[Container SDK] Stream created, waiting for output...');

    // 收集输出
    const chunks = [];
    let errorOutput = '';
    let hasReceivedData = false;

    return new Promise((resolve, reject) => {
      // 设置超时（5 分钟）
      const timeout = setTimeout(() => {
        console.error('[Container SDK] Timeout - no data received for 5 minutes');
        reject(new Error('SDK execution timeout: no response within 5 minutes'));
      }, 5 * 60 * 1000);

      stream.on('data', (chunk) => {
        if (!hasReceivedData) {
          console.log('[Container SDK] First data chunk received');
          hasReceivedData = true;
          clearTimeout(timeout);
        }
        const output = chunk.toString();
        console.log('[Container SDK] Data chunk:', output.substring(0, 100));
        chunks.push(output);

        // 如果可用，发送到 WebSocket
        if (writer && writer.readyState === 1) {
          try {
            // 尝试解析为 JSON 以获得结构化输出
            const jsonData = tryParseJSON(output);
            if (jsonData && jsonData.type) {
              writer.send(jsonData);
            } else {
              writer.send({
                type: 'output',
                sessionId,
                data: output
              });
            }
          } catch (e) {
            // 作为纯文本发送
            writer.send({
              type: 'output',
              sessionId,
              data: output
            });
          }
        }
      });

      stream.on('error', (chunk) => {
        const error = chunk.toString();
        console.error('[Container SDK] Error chunk:', error);
        errorOutput += error;
      });

      stream.on('end', () => {
        console.log('[Container SDK] Stream ended, total chunks:', chunks.length);
        const fullOutput = chunks.join('');

        if (errorOutput) {
          reject(new Error(`SDK execution error: ${errorOutput}`));
        } else {
          resolve({ output: fullOutput, sessionId });
        }
      });
    });

  } catch (error) {
    console.error('[Container SDK] Execution failed:', error);
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
  // 从环境变量获取自定义 API 配置
  const customBaseURL = process.env.ANTHROPIC_BASE_URL;
  const customApiKey = process.env.ANTHROPIC_API_KEY;
  const customModel = process.env.ANTHROPIC_MODEL;

  // 将自定义配置添加到 SDK 选项中
  const sdkOptions = { ...options };

  // 如果环境变量中有自定义配置，应用到选项中
  if (customBaseURL) {
    sdkOptions.baseURL = customBaseURL;
    console.log(`[Container] Using custom API endpoint: ${customBaseURL}`);
  }
  if (customApiKey) {
    sdkOptions.apiKey = customApiKey;
    console.log(`[Container] Using custom API key from environment`);
  }
  if (customModel) {
    sdkOptions.model = customModel;
    console.log(`[Container] Using custom model: ${customModel}`);
  }

  const optionsStr = JSON.stringify(sdkOptions);

  // 使用单引号作为外层引号，避免与 JSON 中的双引号冲突
  return `node -e '
const { query } = require("@anthropic-ai/claude-agent-sdk");

async function execute() {
  try {
    const options = ${optionsStr};
    const result = await query(${JSON.stringify(command)}, options);

    // 流式输出
    for await (const chunk of result) {
      if (chunk.content) {
        console.log(JSON.stringify({
          type: "content",
          content: chunk.content
        }));
      }
    }

    console.log(JSON.stringify({
      type: "done",
      sessionId: "${options.sessionId || ""}"
    }));

  } catch (error) {
    console.error(JSON.stringify({
      type: "error",
      error: error.message
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
