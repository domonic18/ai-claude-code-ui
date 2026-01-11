/**
 * Claude SDK 集成
 *
 * 此模块提供基于 SDK 的 Claude 集成，使用 @anthropic-ai/claude-agent-sdk。
 * 它镜像了 claude-cli.js 的接口，但在内部使用 SDK 以获得更好的性能和可维护性。
 *
 * 主要功能：
 * - 直接 SDK 集成，无需子进程
 * - 支持中止功能的会话管理
 * - CLI 和 SDK 格式之间的选项映射
 * - WebSocket 消息流式传输
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CLAUDE_MODELS } from '../../../shared/modelConstants.js';

// 会话跟踪：会话 ID 到活动查询实例的映射
const activeSessions = new Map();

/**
 * 从环境变量获取自定义 API 配置
 * @returns {Object} 自定义 API 配置（baseURL、apiKey、model）
 */
function getCustomApiConfig() {
  return {
    baseURL: process.env.ANTHROPIC_BASE_URL,
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    model: process.env.ANTHROPIC_MODEL
  };
}

/**
 * 将 CLI 选项映射为 SDK 兼容的选项格式
 * @param {Object} options - CLI 选项
 * @returns {Object} SDK 兼容的选项
 */
function mapCliOptionsToSDK(options = {}) {
  const { sessionId, cwd, toolsSettings, permissionMode, images } = options;

  const sdkOptions = {};

  // 映射工作目录
  if (cwd) {
    sdkOptions.cwd = cwd;
  }

  // 映射权限模式
  if (permissionMode && permissionMode !== 'default') {
    sdkOptions.permissionMode = permissionMode;
  }

  // 映射工具设置
  const settings = toolsSettings || {
    allowedTools: [],
    disallowedTools: [],
    skipPermissions: false
  };

  // 处理工具权限
  if (settings.skipPermissions && permissionMode !== 'plan') {
    // 跳过权限时，使用 bypassPermissions 模式
    sdkOptions.permissionMode = 'bypassPermissions';
  } else {
    // 映射允许的工具
    let allowedTools = [...(settings.allowedTools || [])];

    // 添加计划模式默认工具
    if (permissionMode === 'plan') {
      const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite', 'WebFetch', 'WebSearch'];
      for (const tool of planModeTools) {
        if (!allowedTools.includes(tool)) {
          allowedTools.push(tool);
        }
      }
    }

    if (allowedTools.length > 0) {
      sdkOptions.allowedTools = allowedTools;
    }

    // 映射不允许的工具
    if (settings.disallowedTools && settings.disallowedTools.length > 0) {
      sdkOptions.disallowedTools = settings.disallowedTools;
    }
  }

  // 应用环境变量中的自定义 API 配置
  const customConfig = getCustomApiConfig();

  // 映射模型（默认为 sonnet，或使用环境变量的自定义模型）
  // 有效模型：sonnet、opus、haiku、opusplan、sonnet[1m] 或自定义模型
  if (customConfig.model) {
    sdkOptions.model = customConfig.model;
    console.log(`Using custom model from environment: ${sdkOptions.model}`);
  } else {
    sdkOptions.model = options.model || CLAUDE_MODELS.DEFAULT;
    console.log(`Using model: ${sdkOptions.model}`);
  }

  // 如果指定了自定义 API 基础 URL，则应用
  if (customConfig.baseURL) {
    sdkOptions.baseURL = customConfig.baseURL;
    console.log(`Using custom API endpoint: ${sdkOptions.baseURL}`);
  }

  // 如果指定了自定义 API 密钥，则应用
  if (customConfig.apiKey) {
    sdkOptions.apiKey = customConfig.apiKey;
    console.log(`Using custom API key from environment`);
  }

  // 映射系统提示配置
  sdkOptions.systemPrompt = {
    type: 'preset',
    preset: 'claude_code'  // 使用 CLAUDE.md 所必需
  };

  // 映射 CLAUDE.md 加载的设置源
  // 这将从项目、用户（~/.config/claude/CLAUDE.md）和本地目录加载 CLAUDE.md
  sdkOptions.settingSources = ['project', 'user', 'local'];

  // 映射恢复会话
  if (sessionId) {
    sdkOptions.resume = sessionId;
  }

  return sdkOptions;
}

/**
 * 将会话添加到活动会话映射
 * @param {string} sessionId - 会话标识符
 * @param {Object} queryInstance - SDK 查询实例
 * @param {Array<string>} tempImagePaths - 用于清理的临时图像文件路径
 * @param {string} tempDir - 用于清理的临时目录
 */
function addSession(sessionId, queryInstance, tempImagePaths = [], tempDir = null) {
  activeSessions.set(sessionId, {
    instance: queryInstance,
    startTime: Date.now(),
    status: 'active',
    tempImagePaths,
    tempDir
  });
}

/**
 * 从活动会话映射中移除会话
 * @param {string} sessionId - 会话标识符
 */
function removeSession(sessionId) {
  activeSessions.delete(sessionId);
}

/**
 * 从活动会话映射中获取会话
 * @param {string} sessionId - 会话标识符
 * @returns {Object|undefined} 会话数据或 undefined
 */
function getSession(sessionId) {
  return activeSessions.get(sessionId);
}

/**
 * 获取所有活动会话 ID
 * @returns {Array<string>} 活动会话 ID 数组
 */
function getAllSessions() {
  return Array.from(activeSessions.keys());
}

/**
 * 将 SDK 消息转换为前端期望的 WebSocket 格式
 * @param {Object} sdkMessage - SDK 消息对象
 * @returns {Object} 转换后的消息，可用于 WebSocket
 */
function transformMessage(sdkMessage) {
  // SDK 消息已经与前端兼容的格式
  // CLI 将它们包装在 {type: 'claude-response', data: message} 中
  // 我们在这里做同样的事情以保持兼容性
  return sdkMessage;
}

/**
 * 从 SDK 结果消息中提取 token 使用情况
 * @param {Object} resultMessage - SDK 结果消息
 * @returns {Object|null} Token 预算对象或 null
 */
function extractTokenBudget(resultMessage) {
  if (resultMessage.type !== 'result' || !resultMessage.modelUsage) {
    return null;
  }

  // 获取第一个模型的使用数据
  const modelKey = Object.keys(resultMessage.modelUsage)[0];
  const modelData = resultMessage.modelUsage[modelKey];

  if (!modelData) {
    return null;
  }

  // 如果可用，使用累计 token（跟踪会话总计）
  // 否则回退到每个请求的 token
  const inputTokens = modelData.cumulativeInputTokens || modelData.inputTokens || 0;
  const outputTokens = modelData.cumulativeOutputTokens || modelData.outputTokens || 0;
  const cacheReadTokens = modelData.cumulativeCacheReadInputTokens || modelData.cacheReadInputTokens || 0;
  const cacheCreationTokens = modelData.cumulativeCacheCreationInputTokens || modelData.cacheCreationInputTokens || 0;

  // 总使用量 = 输入 + 输出 + 缓存 token
  const totalUsed = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;

  // 使用环境变量中配置的上下文窗口预算（默认 160000）
  // 这是用户的预算限制，不是模型的上下文窗口
  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 160000;

  console.log(`Token calculation: input=${inputTokens}, output=${outputTokens}, cache=${cacheReadTokens + cacheCreationTokens}, total=${totalUsed}/${contextWindow}`);

  return {
    used: totalUsed,
    total: contextWindow
  };
}

/**
 * 处理 SDK 查询的图像处理
 * 将 base64 图像保存到临时文件并返回带有文件路径的修改后的提示
 * @param {string} command - 原始用户提示
 * @param {Array} images - 包含 base64 数据的图像对象数组
 * @param {string} cwd - 用于创建临时文件的工作目录
 * @returns {Promise<Object>} {modifiedCommand, tempImagePaths, tempDir}
 */
async function handleImages(command, images, cwd) {
  const tempImagePaths = [];
  let tempDir = null;

  if (!images || images.length === 0) {
    return { modifiedCommand: command, tempImagePaths, tempDir };
  }

  try {
    // 在项目目录中创建临时目录
    const workingDir = cwd || process.cwd();
    tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    // 将每个图像保存到临时文件
    for (const [index, image] of images.entries()) {
      // 提取 base64 数据和 mime 类型
      const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        console.error('Invalid image data format');
        continue;
      }

      const [, mimeType, base64Data] = matches;
      const extension = mimeType.split('/')[1] || 'png';
      const filename = `image_${index}.${extension}`;
      const filepath = path.join(tempDir, filename);

      // 将 base64 数据写入文件
      await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
      tempImagePaths.push(filepath);
    }

    // 在提示中包含完整图像路径
    let modifiedCommand = command;
    if (tempImagePaths.length > 0 && command && command.trim()) {
      const imageNote = `\n\n[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
      modifiedCommand = command + imageNote;
    }

    console.log(`Processed ${tempImagePaths.length} images to temp directory: ${tempDir}`);
    return { modifiedCommand, tempImagePaths, tempDir };
  } catch (error) {
    console.error('Error processing images for SDK:', error);
    return { modifiedCommand: command, tempImagePaths, tempDir };
  }
}

/**
 * 清理临时图像文件
 * @param {Array<string>} tempImagePaths - 要删除的临时文件路径数组
 * @param {string} tempDir - 要删除的临时目录
 */
async function cleanupTempFiles(tempImagePaths, tempDir) {
  if (!tempImagePaths || tempImagePaths.length === 0) {
    return;
  }

  try {
    // 删除单个临时文件
    for (const imagePath of tempImagePaths) {
      await fs.unlink(imagePath).catch(err =>
        console.error(`Failed to delete temp image ${imagePath}:`, err)
      );
    }

    // 删除临时目录
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err =>
        console.error(`Failed to delete temp directory ${tempDir}:`, err)
      );
    }

    console.log(`Cleaned up ${tempImagePaths.length} temp image files`);
  } catch (error) {
    console.error('Error during temp file cleanup:', error);
  }
}

/**
 * 从 ~/.claude.json 加载 MCP 服务器配置
 * @param {string} cwd - 用于项目特定配置的当前工作目录
 * @returns {Object|null} MCP 服务器对象，如果未找到则返回 null
 */
async function loadMcpConfig(cwd) {
  try {
    const claudeConfigPath = path.join(os.homedir(), '.claude.json');

    // 检查配置文件是否存在
    try {
      await fs.access(claudeConfigPath);
    } catch (error) {
      // 文件不存在，返回 null
      console.log('No ~/.claude.json found, proceeding without MCP servers');
      return null;
    }

    // 读取并解析配置文件
    let claudeConfig;
    try {
      const configContent = await fs.readFile(claudeConfigPath, 'utf8');
      claudeConfig = JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to parse ~/.claude.json:', error.message);
      return null;
    }

    // 提取 MCP 服务器（合并全局和项目特定）
    let mcpServers = {};

    // 添加全局 MCP 服务器
    if (claudeConfig.mcpServers && typeof claudeConfig.mcpServers === 'object') {
      mcpServers = { ...claudeConfig.mcpServers };
      console.log(`Loaded ${Object.keys(mcpServers).length} global MCP servers`);
    }

    // 添加/覆盖项目特定的 MCP 服务器
    if (claudeConfig.claudeProjects && cwd) {
      const projectConfig = claudeConfig.claudeProjects[cwd];
      if (projectConfig && projectConfig.mcpServers && typeof projectConfig.mcpServers === 'object') {
        mcpServers = { ...mcpServers, ...projectConfig.mcpServers };
        console.log(`Loaded ${Object.keys(projectConfig.mcpServers).length} project-specific MCP servers`);
      }
    }

    // 如果未找到服务器，返回 null
    if (Object.keys(mcpServers).length === 0) {
      console.log('No MCP servers configured');
      return null;
    }

    console.log(`Total MCP servers loaded: ${Object.keys(mcpServers).length}`);
    return mcpServers;
  } catch (error) {
    console.error('Error loading MCP config:', error.message);
    return null;
  }
}

/**
 * 使用 SDK 执行 Claude 查询
 * @param {string} command - 用户提示/命令
 * @param {Object} options - 查询选项
 * @param {Object} ws - WebSocket 连接
 * @returns {Promise<void>}
 */
async function queryClaudeSDK(command, options = {}, ws) {
  const { sessionId } = options;
  let capturedSessionId = sessionId;
  let sessionCreatedSent = false;
  let tempImagePaths = [];
  let tempDir = null;

  try {
    // 将 CLI 选项映射为 SDK 格式
    const sdkOptions = mapCliOptionsToSDK(options);

    // 加载 MCP 配置
    const mcpServers = await loadMcpConfig(options.cwd);
    if (mcpServers) {
      sdkOptions.mcpServers = mcpServers;
    }

    // 处理图像 - 保存到临时文件并修改提示
    const imageResult = await handleImages(command, options.images, options.cwd);
    const finalCommand = imageResult.modifiedCommand;
    tempImagePaths = imageResult.tempImagePaths;
    tempDir = imageResult.tempDir;

    // 创建 SDK 查询实例
    const queryInstance = query({
      prompt: finalCommand,
      options: sdkOptions
    });

    // 跟踪查询实例以支持中止功能
    if (capturedSessionId) {
      addSession(capturedSessionId, queryInstance, tempImagePaths, tempDir);
    }

    // 处理流式消息
    console.log('Starting async generator loop for session:', capturedSessionId || 'NEW');
    for await (const message of queryInstance) {
      // 从第一条消息捕获会话 ID
      if (message.session_id && !capturedSessionId) {

        capturedSessionId = message.session_id;
        addSession(capturedSessionId, queryInstance, tempImagePaths, tempDir);

        // 在 writer 上设置会话 ID
        if (ws.setSessionId && typeof ws.setSessionId === 'function') {
          ws.setSessionId(capturedSessionId);
        }

        // 仅为新会话发送一次 session-created 事件
        if (!sessionId && !sessionCreatedSent) {
          sessionCreatedSent = true;
          ws.send({
            type: 'session-created',
            sessionId: capturedSessionId
          });
        } else {
          console.log('Not sending session-created. sessionId:', sessionId, 'sessionCreatedSent:', sessionCreatedSent);
        }
      } else {
        console.log('No session_id in message or already captured. message.session_id:', message.session_id, 'capturedSessionId:', capturedSessionId);
      }

      // 转换并发送消息到 WebSocket
      const transformedMessage = transformMessage(message);
      ws.send({
        type: 'claude-response',
        data: transformedMessage
      });

      // 从结果消息中提取并发送 token 预算更新
      if (message.type === 'result') {
        const tokenBudget = extractTokenBudget(message);
        if (tokenBudget) {
          console.log('Token budget from modelUsage:', tokenBudget);
          ws.send({
            type: 'token-budget',
            data: tokenBudget
          });
        }
      }
    }

    // 完成时清理会话
    if (capturedSessionId) {
      removeSession(capturedSessionId);
    }

    // 清理临时图像文件
    await cleanupTempFiles(tempImagePaths, tempDir);

    // 发送完成事件
    console.log('Streaming complete, sending claude-complete event');
    ws.send({
      type: 'claude-complete',
      sessionId: capturedSessionId,
      exitCode: 0,
      isNewSession: !sessionId && !!command
    });
    console.log('claude-complete event sent');

  } catch (error) {
    console.error('SDK query error:', error);

    // 错误时清理会话
    if (capturedSessionId) {
      removeSession(capturedSessionId);
    }

    // 错误时清理临时图像文件
    await cleanupTempFiles(tempImagePaths, tempDir);

    // 发送错误到 WebSocket
    ws.send({
      type: 'claude-error',
      error: error.message
    });

    throw error;
  }
}

/**
 * 中止活动的 SDK 会话
 * @param {string} sessionId - 会话标识符
 * @returns {boolean} 如果会话已中止则为 true，如果未找到则为 false
 */
async function abortClaudeSDKSession(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    console.log(`Session ${sessionId} not found`);
    return false;
  }

  try {
    console.log(`Aborting SDK session: ${sessionId}`);

    // 在查询实例上调用 interrupt()
    await session.instance.interrupt();

    // 更新会话状态
    session.status = 'aborted';

    // 清理临时图像文件
    await cleanupTempFiles(session.tempImagePaths, session.tempDir);

    // 清理会话
    removeSession(sessionId);

    return true;
  } catch (error) {
    console.error(`Error aborting session ${sessionId}:`, error);
    return false;
  }
}

/**
 * 检查 SDK 会话是否当前活动
 * @param {string} sessionId - 会话标识符
 * @returns {boolean} 如果会话活动则为 true
 */
function isClaudeSDKSessionActive(sessionId) {
  const session = getSession(sessionId);
  return session && session.status === 'active';
}

/**
 * 获取所有活动 SDK 会话 ID
 * @returns {Array<string>} 活动会话 ID 数组
 */
function getActiveClaudeSDKSessions() {
  return getAllSessions();
}

// 导出公共 API
export {
  queryClaudeSDK,
  abortClaudeSDKSession,
  isClaudeSDKSessionActive,
  getActiveClaudeSDKSessions
};
