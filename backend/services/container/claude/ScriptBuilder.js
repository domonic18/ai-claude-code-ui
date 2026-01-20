/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 */

import { UserSettingsService } from '../../settings/UserSettingsService.js';

/**
 * 过滤 SDK 选项，移除不需要传给 SDK 的字段
 * @param {object} options - 原始选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>} 过滤后的选项
 */
async function filterSDKOptions(options, userId) {
  const sdkOptions = { ...options };

  // 获取用户设置（优先使用数据库中的设置）
  let userSettings = null;
  try {
    userSettings = await UserSettingsService.getSettings(userId, 'claude');
    console.log('[ScriptBuilder] Loaded user settings for user:', userId);
  } catch (error) {
    console.warn('[ScriptBuilder] Failed to load user settings, using defaults:', error.message);
  }

  // 合并用户设置和前端传入的设置
  // 优先级：前端传入 > 用户设置 > 默认值
  const settings = options.toolsSettings || {};

  // 如果用户设置存在且前端没有覆盖，则使用用户设置
  if (userSettings) {
    // allowedTools: 只有在前端没有传入时才使用用户设置
    if (!settings.allowedTools && userSettings.allowed_tools && userSettings.allowed_tools.length > 0) {
      sdkOptions.allowedTools = userSettings.allowed_tools;
      console.log('[ScriptBuilder] Using user settings for allowedTools:', userSettings.allowed_tools);
    }
    // disallowedTools: 只有在前端没有传入时才使用用户设置
    if (!settings.disallowedTools && userSettings.disallowed_tools && userSettings.disallowed_tools.length > 0) {
      sdkOptions.disallowedTools = userSettings.disallowed_tools;
      console.log('[ScriptBuilder] Using user settings for disallowedTools:', userSettings.disallowed_tools);
    }
    // skipPermissions: 只有在前端没有传入时才使用用户设置
    if (settings.skipPermissions === undefined && userSettings.skip_permissions !== undefined) {
      settings.skipPermissions = userSettings.skip_permissions;
      console.log('[ScriptBuilder] Using user settings for skipPermissions:', userSettings.skip_permissions);
    }
  }

  // 从 toolsSettings 提取配置（如果存在，包括前端传入和用户设置）
  if (settings.allowedTools && settings.allowedTools.length > 0) {
    sdkOptions.allowedTools = settings.allowedTools;
  }
  if (settings.disallowedTools && settings.disallowedTools.length > 0) {
    sdkOptions.disallowedTools = settings.disallowedTools;
  }

  // 移除不需要传给 SDK 的字段
  delete sdkOptions.userId;
  delete sdkOptions.isContainerProject;
  delete sdkOptions.projectPath;
  delete sdkOptions.toolsSettings;

  // 设置默认工具，如果最终没有配置任何工具
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [
      'Bash(git log:*)',
      'Bash(git diff:*)',
      'Bash(git status:*)',
      'Write',
      'Read',
      'Edit',
      'Glob',
      'Grep',
      'MultiEdit',
      'Task',
      'TodoWrite',
      'TodoRead',
      'WebFetch',
      'WebSearch'
    ];
    console.log('[ScriptBuilder] Setting default allowedTools');
  }

  // 处理权限模式
  // 如果前端指定了 skipPermissions，或者在容器模式下且没有明确指定 permissionMode
  if (settings.skipPermissions || !sdkOptions.permissionMode || sdkOptions.permissionMode === 'default') {
    sdkOptions.permissionMode = 'bypassPermissions';
    console.log('[ScriptBuilder] Setting permissionMode: bypassPermissions (reason:',
      settings.skipPermissions ? 'skipPermissions' : (sdkOptions.permissionMode || 'default'), ')');
  }

  // 处理 resume 参数：
  // - 如果有 sessionId 且 resume 为 true，将 resume 设置为 sessionId
  // - 否则完全移除 resume 参数（SDK 不接受 resume: false）
  if (options.sessionId && options.resume === true) {
    sdkOptions.resume = options.sessionId;
  } else {
    // 移除 resume 参数（不管是 false 还是其他值）
    delete sdkOptions.resume;
  }

  // 禁用交互式规划工具（前端暂不支持）
  // 这些工具需要用户实时交互，Web 界面暂时不支持
  const interactivePlanningTools = [
    'EnterPlanMode',   // 进入规划模式
    'AskUserQuestion', // 向用户提问
    'ExitPlanMode'     // 退出规划模式
  ];

  // 合并已有的 disallowedTools
  if (sdkOptions.disallowedTools && sdkOptions.disallowedTools.length > 0) {
    sdkOptions.disallowedTools = [...sdkOptions.disallowedTools, ...interactivePlanningTools];
  } else {
    sdkOptions.disallowedTools = interactivePlanningTools;
  }

  console.log('[ScriptBuilder] Disallowed interactive planning tools:', interactivePlanningTools);

  // 移除 sessionId（SDK 不需要这个参数）
  delete sdkOptions.sessionId;

  // 处理 model 参数：如果是 "custom"，则从环境变量读取
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }

  return sdkOptions;
}

/**
 * 生成 SDK 执行脚本
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<string>} 完整的 Node.js 执行脚本
 */
export async function buildSDKScript(command, options, userId) {
  // 提取 sessionId 以便在脚本中使用
  const sessionId = options.sessionId || '';

  // 过滤并处理 options（现在是异步的）
  const sdkOptions = await filterSDKOptions(options, userId);

  // 使用 base64 编码来避免转义问题（包括 options 和 command）
  const optionsJson = JSON.stringify(sdkOptions);
  const optionsBase64 = Buffer.from(optionsJson).toString('base64');

  // 对命令也使用 base64 编码，避免特殊字符问题
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  // 生成脚本模板
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

    // 从 base64 解码命令
    const command = Buffer.from("${commandBase64}", "base64").toString("utf-8");

    console.error("[SDK] Options:", JSON.stringify(options, null, 2));
    console.error("[SDK] Command:", command);

    // 重要：设置 SDK 的工作目录环境变量
    // SDK 使用 HOME 或 USERPROFILE 等环境变量来确定配置文件位置
    // 我们通过设置这些环境变量来确保 SDK 在正确的位置创建会话文件
    if (options.cwd) {
      const projectDir = options.cwd;
      console.error("[SDK] Setting HOME to project directory:", projectDir);
      process.env.HOME = projectDir;
      // 也设置其他可能的环境变量
      process.env.USERPROFILE = projectDir;

      // 切换到项目目录，确保工具在正确的位置执行
      console.error("[SDK] Changing CWD to:", projectDir);
      try {
        process.chdir(projectDir);
      } catch (chdirError) {
        console.error("[SDK] Failed to change directory:", chdirError.message);
      }
    }

    // Claude SDK 接受一个对象参数：{ prompt, options }
    const result = query({
      prompt: command,
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

