/**
 * Claude Query Orchestrator
 *
 * Main entry point that coordinates container acquisition, working directory
 * mapping, session management, and execution.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import containerManager from '../core/index.js';
import { executeInContainer } from './DockerExecutor.js';
import { createSession, updateSession, scheduleSessionCleanup } from './SessionManager.js';
import { CONTAINER } from '../../../config/config.js';
import { getModelProviderConfig } from '../../../config/modelConfig.js';
import { userPromptService } from '../../user-prompt/index.js';
import { projectPromptService, projectOverviewService } from '../../projects/index.js';
import { sessionExistsInProject } from '../../sessions/container/ContainerSessions.js';
import { createLogger, sanitizePreview, startTimer, withTimer } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/ClaudeQuery');

// 任务正常完成后，延迟清理 session 的窗口（毫秒）。
// 不立即删除：给刷新重连留一个短窗口接续输出；超时后由 scheduleSessionCleanup→abortSession 清理，防 Map 泄漏。
const COMPLETED_CLEANUP_MS = 10000;

// 用于在 system prompt 中标记用户提示词上下文分节（仅做结构化，不再用于剥离用户消息）
const USER_PROMPT_START = '--- User Prompt Context ---';
const USER_PROMPT_END = '--- End User Prompt Context ---';

// 用于在 system prompt 中标记项目级提示词分节（与 user-prompt 对称，不含路径）
const PROJECT_PROMPT_START = '--- Project Prompt ---';
const PROJECT_PROMPT_END = '--- End Project Prompt ---';

// 用于在 system prompt 中标记案件概览分节（历史会话摘要，给 AI 跨会话上下文）
const OVERVIEW_START = '--- Case Overview ---';
const OVERVIEW_END = '--- End Case Overview ---';

// 用于解析 SDK 执行的正确工作目录路径的辅助函数
/**
 * 映射工作目录
 * @param {boolean} isContainerProject - 是否为容器项目
 * @param {string} projectPath - 项目路径（如 "my-workspace"）
 * @param {string} cwd - 当前工作目录
 * @returns {string} 映射后的工作目录
 *
 * 注意：根据文档设计（docs/arch/data-storage-design.md）：
 * - 项目代码目录：/workspace/my-workspace/ （实际的项目代码）
 * - Claude 元数据：/workspace/.claude/projects/my-workspace/ （会话历史）
 * - SDK 需要在项目代码目录中运行（cwd: /workspace/my-workspace）
 */
function mapWorkingDirectory(isContainerProject, projectPath, cwd) {
  if (isContainerProject && projectPath) {
    // 容器项目：项目代码直接在 /workspace 下，不在 .claude/projects 下
    // 例如：my-workspace -> /workspace/my-workspace
    return `${CONTAINER.paths.workspace}/${projectPath}`.replace(/\/+/g, '/');
  } else if (cwd) {
    // 工作空间文件：提取基本名称并使用 /workspace
    return `${CONTAINER.paths.workspace}/${path.basename(cwd)}`.replace(/\/+/g, '/');
  } else {
    return CONTAINER.paths.workspace;
  }
}

// 加载用户的用户提示词文件以作为 Claude 对话的上下文包含在内
/**
 * 加载用户提示词内容
 * @param {number} userId - 用户 ID
 * @param {object} options - 选项
 * @returns {Promise<string|null>} 用户提示词内容，如果没有则返回 null
 */
async function loadUserPromptContext(userId, options) {
  try {
    const promptResult = await userPromptService.readUserPrompt(userId, {
      containerMode: options.containerMode
    });

    if (promptResult && promptResult.content) {
      // 返回原始用户提示词内容，不添加标记
      return promptResult.content;
    }
  } catch (error) {
    // 如果读取用户提示词失败，记录警告但继续执行
    logger.warn({ err: error }, 'Failed to load user prompt context');
  }
  return null;
}

// 加载项目级提示词以作为 Claude 对话的上下文
/**
 * 加载项目提示词内容
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {object} options - 选项
 * @returns {Promise<string|null>} 提示词内容；为空或不存在则返回 null（不注入）
 */
async function loadProjectPromptContext(userId, projectName, options) {
  if (!projectName) return null;
  try {
    const result = await projectPromptService.readProjectPrompt(userId, projectName, {
      containerMode: options.containerMode
    });
    const content = (result?.content || '').trim();
    if (!content) return null;
    return content;
  } catch (error) {
    // 读取失败不应阻断主流程，仅告警
    logger.warn({ err: error }, 'Failed to load project prompt context');
  }
  return null;
}

/**
 * 加载案件概览（历史会话摘要，给 AI 跨会话上下文）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {object} options - 选项
 * @returns {Promise<string|null>} 概览文本；为空或不存在则返回 null（不注入）
 */
async function loadOverviewContext(userId, projectName, options = {}) {
  if (!projectName) return null;
  try {
    const content = await projectOverviewService.readAllForInjection(userId, projectName);
    return content || null;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to load overview context');
    return null;
  }
}

/**
 * 构建系统上下文分片（工作目录提示 + 用户提示词 + 项目级提示词）
 *
 * 这些内容不再拼进用户命令，而是作为 systemContextParts 累积，最终由
 * systemPrompt.append 注入，使 SDK 的 user turn 保持为用户原始输入。
 *
 * @param {string|null} userPromptContext - 用户提示词
 * @param {string|null} projectPromptContext - 项目级提示词
 * @param {string} cwd - 当前工作目录（如 /workspace/我的工作区）
 * @returns {string[]} 系统上下文分片数组
 */
function buildContextParts(userPromptContext, projectPromptContext, overviewContext, cwd) {
  const parts = [];

  // 工作目录提示，确保 AI 将文件写入正确的项目目录
  parts.push(`【系统提示】当前工作目录：${cwd}。所有文件必须写入此目录或其子目录中，禁止使用 /workspace/ 作为文件路径前缀。`);

  if (userPromptContext) {
    parts.push(`${USER_PROMPT_START}\n${userPromptContext}\n${USER_PROMPT_END}`);
  }

  // 项目级提示词置于用户提示词块之后（项目级更具体，后置）；空则不注入
  if (projectPromptContext) {
    parts.push(`${PROJECT_PROMPT_START}\n${projectPromptContext}\n${PROJECT_PROMPT_END}`);
  }

  // 案件概览（历史会话摘要，给 AI 跨会话上下文）；空则不注入
  if (overviewContext) {
    parts.push(`${OVERVIEW_START}\n以下是本案件历史会话的摘要，供你了解之前聊过什么（仅作背景参考，不要复述）：\n${overviewContext}\n${OVERVIEW_END}`);
  }

  return parts;
}

// 通知前端会话启动并在 UI 中包含用户提示词
/**
 * 发送会话启动和用户提示词消息
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {string} containerId - 容器 ID
 * @param {string|null} userPromptContext - 用户提示词
 */
function sendSessionStart(writer, sessionId, containerId, userPromptContext) {
  if (!writer) return;

  // 发送用户提示词消息（如果有）
  if (userPromptContext) {
    logger.debug({ sessionId, promptLength: userPromptContext.length }, '[ClaudeQuery] Sending user-prompt-context');
    writer.send({
      type: 'user-prompt-context',
      sessionId,
      content: userPromptContext
    });
  }

  // 发送初始消息
  logger.debug({ sessionId }, '[ClaudeQuery] Sending session_start');
  writer.send({
    type: 'session_start',
    sessionId,
    containerId: containerId,
    message: 'Starting containerized Claude session...'
  });
}

// 查询失败的集中错误处理程序
/**
 * 处理查询错误
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {Error} error - 错误对象
 */
function handleQueryError(writer, sessionId, error) {
  updateSession(sessionId, {
    status: 'error',
    error: error.message,
    endTime: Date.now()
  });

  if (writer) {
    writer.send({
      type: 'error',
      sessionId,
      error: error.message
    });
  }
}

// 在 SessionManager 中注册会话以进行跟踪和中止功能
/**
 * 创建并配置会话
 * @param {string} sessionId - 会话 ID
 * @param {object} container - 容器对象
 * @param {string} command - 用户命令
 * @param {object} mappedOptions - 映射后的选项
 */
function setupSession(sessionId, container, command, mappedOptions) {
  createSession(sessionId, {
    userId: mappedOptions.userId,
    containerId: container.id,
    command: command,
    options: mappedOptions
  });
  logger.info({ sessionId }, '[ClaudeQuery] Session created');
}

// 由 /api/claude/chat WebSocket 处理程序调用的主入口点
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

  const queryTimer = startTimer('claude/query');
  logger.info({ sessionId, userId }, '[ClaudeQuery] Query started');
  logger.debug({ sessionId, preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[ClaudeQuery] User command');
  logger.debug({ sessionId, isContainerProject, projectPath }, '[ClaudeQuery] Project context');

  try {
    // 1. 加载用户提示词上下文
    const userPromptContext = await withTimer('claude/user_prompt_load', logger,
      () => loadUserPromptContext(userId, { containerMode: options.containerMode }),
      {
        successMsg: 'User prompt context loaded',
        successExtra: (result) => ({ sessionId, promptLength: result?.length || 0 }),
      }
    );

    // 1b. 加载项目级提示词（仅容器项目有 projectName；为空则不注入）
    const projectPromptProjectName = isContainerProject ? projectPath : '';
    const projectPromptContext = projectPromptProjectName
      ? await loadProjectPromptContext(userId, projectPromptProjectName, { containerMode: options.containerMode })
      : null;

    // 1c. 加载案件概览（历史会话摘要，给 AI 跨会话上下文；无摘要则不注入）
    const overviewContext = projectPromptProjectName
      ? await loadOverviewContext(userId, projectPromptProjectName, { containerMode: options.containerMode })
      : null;

    // 2. 获取或创建用户容器
    logger.debug({ sessionId, userId }, '[ClaudeQuery] Getting container for user');
    const container = await withTimer('claude/container_get', logger,
      () => containerManager.getOrCreateContainer(userId, { tier: userTier }),
      {
        successMsg: 'Container obtained',
        successExtra: (c) => ({ sessionId, containerName: c.name }),
      }
    );

    // 3. 映射工作目录
    const workingDir = mapWorkingDirectory(isContainerProject, projectPath, cwd);
    logger.debug({ sessionId, workingDir }, '[ClaudeQuery] Working directory mapped');

    // 传递 cwd 给 SDK，但 SDK 脚本会使用它来设置 HOME 环境变量
    // 这样 SDK 会在正确的项目目录下创建会话文件，而不会影响子进程的模块查找
    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      userId,
      cwd: workingDir
    };

    // 3.5 安全校验：resume 前确认 sessionId 真实属于当前 project，防止跨项目串线
    // 前端切项目时若 currentSessionId 残留，会发出 projectPath=B、sessionId=A 的错配请求；
    // 后端在此兜底：session 不属于该 project 时降级为新会话（删 resume），由 SDK 在正确
    // cwd 下开启全新会话，避免把对话内容写到错误项目目录。
    if (mappedOptions.resume === true && isContainerProject && projectPath) {
      const belongsToProject = await sessionExistsInProject(userId, projectPath, sessionId);
      if (!belongsToProject) {
        logger.warn({
          userId, sessionId, projectPath, reason: 'session-not-in-project',
        }, '[ClaudeQuery] Resume blocked: session does not belong to this project, downgrading to new session');
        delete mappedOptions.resume;
      }
    }

    // 4. 根据模型获取 provider 端点配置
    const modelName = mappedOptions.model || '';
    const providerConfig = getModelProviderConfig(modelName);
    logger.info({ sessionId, modelName, providerBaseURL: providerConfig.baseURL }, '[ClaudeQuery] Provider config resolved');

    // 5. 创建会话
    setupSession(sessionId, container, command, mappedOptions);

    // 6. 发送会话启动和用户提示词消息
    sendSessionStart(writer, sessionId, container.id, userPromptContext);

    // 7. 累积系统上下文到选项（不再污染用户命令），并以原始命令执行
    const contextParts = buildContextParts(userPromptContext, projectPromptContext, overviewContext, workingDir);
    mappedOptions.systemContextParts = [
      ...(Array.isArray(mappedOptions.systemContextParts) ? mappedOptions.systemContextParts : []),
      ...contextParts,
    ];
    logger.debug({ sessionId }, '[ClaudeQuery] Executing in container');
    await executeInContainer(userId, command, mappedOptions, writer, sessionId, providerConfig);
    logger.info({ sessionId }, '[ClaudeQuery] Execution completed');
    queryTimer.end(logger, 'Claude query completed', { sessionId });

    // 8. 更新会话状态
    updateSession(sessionId, {
      status: 'completed',
      endTime: Date.now()
    });

    // 延迟清理 session（修复完成后不删除导致的 Map 泄漏），并给刷新重连留短窗口
    scheduleSessionCleanup(sessionId, COMPLETED_CLEANUP_MS);

    return sessionId;

  } catch (error) {
    queryTimer.endError(logger, 'Claude query failed', { sessionId });
    handleQueryError(writer, sessionId, error);
    // 异常路径同样调度清理，防止 session 残留在 Map 导致泄漏
    scheduleSessionCleanup(sessionId, COMPLETED_CLEANUP_MS);
    throw error;
  }
}
