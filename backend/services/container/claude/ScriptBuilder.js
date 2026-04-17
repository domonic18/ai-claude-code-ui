/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 */

import { UserSettingsService } from '../../settings/UserSettingsService.js';
import { loadAgentsForSDK } from '../../../services/extensions/extension-sync.js';
import { randomUUID } from 'crypto';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/claude/ScriptBuilder');

/** 系统级禁用的交互式规划工具（前端暂不支持） */
const INTERACTIVE_PLANNING_TOOLS = [
  'EnterPlanMode',   // 进入规划模式
  'AskUserQuestion', // 向用户提问
  'ExitPlanMode'     // 退出规划模式
];

/** 默认允许的工具列表 */
const DEFAULT_ALLOWED_TOOLS = [
  // Git 相关命令
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  // 文档处理命令（PDF、Word 等）
  'Bash(pdftotext:*)',
  'Bash(pandoc:*)',
  'Bash(file:*)',
  // 其他工具
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
  'WebSearch',
  'Skill'           // 关键修复：启用 Skill 工具，否则 SDK 不会加载 Skills
];

/** 需要从 SDK 选项中移除的内部字段 */
const INTERNAL_FIELDS_TO_REMOVE = [
  'userId',
  'isContainerProject',
  'projectPath',
  'toolsSettings',
  'images',       // 图片数据在 DockerExecutor 中处理
  'imagePaths'    // 图片路径在脚本中单独处理
];

/**
 * 合并用户设置到 SDK 选项
 * 优先级：前端传入 > 数据库用户设置 > 默认值
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 前端传入的 toolsSettings
 * @param {number} userId - 用户 ID
 */
async function mergeUserSettings(sdkOptions, settings, userId) {
  let userSettings = null;
  try {
    userSettings = await UserSettingsService.getSettings(userId, 'claude');
    logger.debug({ userId }, 'Loaded user settings for user');
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to load user settings, using defaults');
  }

  if (!userSettings) {
    return;
  }

  // allowedTools: 只有在前端没有传入时才使用用户设置
  if (!settings.allowedTools && userSettings.allowed_tools?.length > 0) {
    sdkOptions.allowedTools = userSettings.allowed_tools;
    logger.debug({ allowedTools: userSettings.allowed_tools }, 'Using user settings for allowedTools');
  }
  // disallowedTools: 只有在前端没有传入时才使用用户设置
  if (!settings.disallowedTools && userSettings.disallowed_tools?.length > 0) {
    sdkOptions.disallowedTools = userSettings.disallowed_tools;
    logger.debug({ disallowedTools: userSettings.disallowed_tools }, 'Using user settings for disallowedTools');
  }
  // skipPermissions: 使用 != null 同时排除 null 和 undefined，明确处理 false 值
  if (settings.skipPermissions == null && userSettings.skip_permissions != null) {
    settings.skipPermissions = userSettings.skip_permissions;
    logger.debug({ skipPermissions: userSettings.skip_permissions }, 'Using user settings for skipPermissions');
  }
}

/**
 * 设置默认工具列表（当没有配置任何工具时）
 * @param {object} sdkOptions - SDK 选项（可变）
 */
function setDefaultTools(sdkOptions) {
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [...DEFAULT_ALLOWED_TOOLS];
    logger.debug('Setting default allowedTools');
  }
}

/**
 * 配置扩展加载（agents 和 plugins）
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项
 */
async function configureExtensions(sdkOptions, options) {
  // 关键修复：设置 settingSources 以从文件系统加载扩展
  // SDK 将自动从 settings.json / CLAUDE.md / skills/ / agents/ 等位置加载
  sdkOptions.settingSources = ['user', 'project'];
  logger.debug('Setting settingSources: user, project');

  if (options.enableExtensions === false) {
    return;
  }

  try {
    // 动态加载 agents（从 .md 文件读取）
    sdkOptions.agents = await loadAgentsForSDK();
    logger.debug({ agents: Object.keys(sdkOptions.agents) }, 'Loaded agents');

    // 配置 plugins 指向 skills 目录，SDK 会自动扫描
    sdkOptions.plugins = [{ type: 'local', path: '/workspace/.claude' }];
    logger.debug('Configured plugins for skills scanning');
  } catch (error) {
    logger.error({ error }, 'Failed to load extensions');
    sdkOptions.agents = {};
    sdkOptions.plugins = [];
  }
}

/**
 * 确定权限模式
 * 优先级：前端传入的 permissionMode > skipPermissions > 默认 bypass
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} settings - 合并后的 toolsSettings
 * @returns {string[]} 用户级禁止工具列表（不含系统级）
 */
function determinePermissionMode(sdkOptions, settings) {
  // 提取用户设置的禁止工具（排除系统级的 interactivePlanningTools）
  const userDisallowedTools = sdkOptions.disallowedTools
    ? sdkOptions.disallowedTools.filter(tool => !INTERACTIVE_PLANNING_TOOLS.includes(tool))
    : [];
  const hasUserDisallowedTools = userDisallowedTools.length > 0;
  const usingDefaultTools = !sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0;

  if (sdkOptions.permissionMode) {
    // 前端明确传入了 permissionMode
    if (sdkOptions.permissionMode === 'bypassPermissions' && hasUserDisallowedTools) {
      logger.warn({ disallowedTools: userDisallowedTools }, 'WARNING: bypassPermissions mode will disable user-set disallowedTools');
    }
    logger.debug({ permissionMode: sdkOptions.permissionMode }, 'Using frontend permissionMode');
  } else if (settings.skipPermissions && !hasUserDisallowedTools) {
    // 用户设置 skipPermissions 且没有用户禁止工具
    sdkOptions.permissionMode = 'bypassPermissions';
    logger.debug('Setting permissionMode: bypassPermissions (reason: skipPermissions=true, no user disallowedTools)');
  } else if (usingDefaultTools && !hasUserDisallowedTools) {
    // 使用默认工具列表且没有用户禁止工具
    sdkOptions.permissionMode = 'bypassPermissions';
    logger.debug('Setting permissionMode: bypassPermissions (reason: using default tools, no user disallowedTools)');
  } else {
    sdkOptions.permissionMode = 'default';
    logger.debug({ reason: hasUserDisallowedTools ? 'has user disallowedTools' : 'default fallback' }, 'Setting permissionMode: default');
  }

  return userDisallowedTools;
}

/**
 * 清理 SDK 选项中的内部字段和参数
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项
 * @param {string[]} userDisallowedTools - 用户级禁止工具列表
 */
function cleanupSdkOptions(sdkOptions, options, userDisallowedTools) {
  // 移除不需要传给 SDK 的内部字段
  for (const field of INTERNAL_FIELDS_TO_REMOVE) {
    delete sdkOptions[field];
  }

  // 处理 resume 参数：有 sessionId 且 resume 为 true 时才保留
  if (options.sessionId && options.resume === true) {
    sdkOptions.resume = options.sessionId;
  } else {
    delete sdkOptions.resume;
  }

  // 合并系统级和用户级的 disallowedTools
  sdkOptions.disallowedTools = [...userDisallowedTools, ...INTERACTIVE_PLANNING_TOOLS];
  logger.debug({ interactivePlanningTools: INTERACTIVE_PLANNING_TOOLS }, 'Disallowed interactive planning tools');
  if (userDisallowedTools.length > 0) {
    logger.debug({ userDisallowedTools }, 'User disallowed tools');
  }

  // 移除 sessionId（SDK 不需要这个参数）
  delete sdkOptions.sessionId;

  // 处理 model 参数：如果是 "custom"，则由环境变量决定
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }

  logger.debug({ keys: Object.keys(sdkOptions) }, 'Returning sdkOptions keys');
}

/**
 * 过滤 SDK 选项，移除不需要传给 SDK 的字段
 * @param {object} options - 原始选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>} 过滤后的选项
 */
async function filterSDKOptions(options, userId) {
  const sdkOptions = { ...options };
  const settings = options.toolsSettings || {};

  // 步骤 1：合并用户设置到 SDK 选项
  await mergeUserSettings(sdkOptions, settings, userId);

  // 步骤 2：从 toolsSettings 提取最终配置覆盖
  if (settings.allowedTools?.length > 0) {
    sdkOptions.allowedTools = settings.allowedTools;
  }
  if (settings.disallowedTools?.length > 0) {
    sdkOptions.disallowedTools = settings.disallowedTools;
  }

  // 步骤 3：设置默认工具
  setDefaultTools(sdkOptions);

  // 步骤 4：配置扩展加载
  await configureExtensions(sdkOptions, options);

  // 步骤 5：确定权限模式
  const userDisallowedTools = determinePermissionMode(sdkOptions, settings);

  // 步骤 6：清理内部字段和参数
  cleanupSdkOptions(sdkOptions, options, userDisallowedTools);

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

  // 提取图片路径（已由 DockerExecutor 复制到容器内）
  const imagePaths = options.imagePaths || [];
  logger.debug({ imagePaths }, 'Image paths received');

  // 过滤并处理 options（现在是异步的）
  const sdkOptions = await filterSDKOptions(options, userId);

  // 调试：打印 options 摘要
  logger.debug({ model: sdkOptions.model }, 'Original sdkOptions.model');
  const optionsJsonLength = JSON.stringify(sdkOptions).length;
  logger.debug({ size: optionsJsonLength }, 'optionsJson size');

  // 使用 base64 编码来避免转义问题
  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  // 安全断言：base64 标准字符集不包含模板字符串特殊字符（" $ `），防止注入
  const BASE64_SAFE = /^[A-Za-z0-9+/=]+$/;
  if (!BASE64_SAFE.test(commandBase64)) {
    throw new Error('commandBase64 contains non-standard base64 characters');
  }
  if (!BASE64_SAFE.test(optionsBase64)) {
    throw new Error('optionsBase64 contains non-standard base64 characters');
  }

  // 生成唯一的临时文件名，使用 crypto.randomUUID() 保证唯一性和不可预测性
  const tmpId = randomUUID();
  const tmpOptionsFile = `/tmp/sdk_opts_${tmpId}.b64`;
  const tmpScriptFile = `/tmp/sdk_exec_${tmpId}.mjs`;

  // 生成脚本内容（不包含 base64 数据，从文件读取）
  // 注意：使用 /app/node_modules 绝对路径导入 SDK，因为脚本文件在 /tmp/ 下，
  // ESM 模块解析基于脚本文件所在目录而非 cwd，无法通过裸模块名找到 SDK
  const scriptContent = `import { query } from "/app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";
import { readFileSync, unlinkSync } from "fs";

async function execute() {
  try {
    console.error("[SDK] Starting execution...");
    console.error("[SDK] Environment check:");
    console.error("[SDK] - ANTHROPIC_AUTH_TOKEN:", process.env.ANTHROPIC_AUTH_TOKEN ? "SET (length=" + process.env.ANTHROPIC_AUTH_TOKEN.length + ")" : "NOT SET");
    console.error("[SDK] - ANTHROPIC_BASE_URL:", process.env.ANTHROPIC_BASE_URL || "NOT SET (will use default)");
    console.error("[SDK] - ANTHROPIC_MODEL:", process.env.ANTHROPIC_MODEL || "NOT SET (will use default)");

    // 从临时文件读取并解码 options（避免命令行参数过长）
    const optionsB64 = readFileSync("${tmpOptionsFile}", "utf-8").trim();
    const optionsJson = Buffer.from(optionsB64, "base64").toString("utf-8");
    console.error("[SDK] Decoded options JSON length:", optionsJson.length);
    const options = JSON.parse(optionsJson);

    // 从 base64 解码命令
    let command = Buffer.from("${commandBase64}", "base64").toString("utf-8");

    // 添加图片路径到命令（如果有）
    const imagePaths = ${JSON.stringify(imagePaths)};
    if (imagePaths.length > 0) {
      console.error("[SDK] Images available at:", imagePaths);
      const imageNote = "\\n\\n[Images provided at the following paths:]\\n" +
        imagePaths.map((p, i) => (i + 1) + ". " + p).join("\\n") +
        "\\n\\nPlease use the Read tool to view these images and analyze them.";
      command = command + imageNote;
    }

    console.error("[SDK] Options model:", options.model);
    console.error("[SDK] Command:", command);

    // 切换到项目目录，确保工具在正确的位置执行
    if (options.cwd) {
      const projectDir = options.cwd;
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
      console.error("[SDK] Received chunk #" + chunkCount + " type=" + (chunk && chunk.type) || "unknown");

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

    // 清理临时文件
    try { unlinkSync("${tmpOptionsFile}"); } catch {}
    try { unlinkSync("${tmpScriptFile}"); } catch {}

  } catch (error) {
    console.error("[SDK] Error occurred:", error.message);
    console.error("[SDK] Stack:", error.stack);
    console.error(JSON.stringify({
      type: "error",
      error: error.message,
      stack: error.stack
    }));
    // 清理临时文件
    try { unlinkSync("${tmpOptionsFile}"); } catch {}
    try { unlinkSync("${tmpScriptFile}"); } catch {}
    process.exit(1);
  }
}

execute();
`;

  // 返回执行所需的信息：脚本内容、options base64 数据、临时文件路径
  // DockerExecutor 负责将文件写入容器并执行
  return {
    scriptContent,
    optionsBase64,
    tmpOptionsFile,
    tmpScriptFile
  };
}

