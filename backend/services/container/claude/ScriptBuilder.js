/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 */

import { UserSettingsService } from '../../settings/UserSettingsService.js';
import { loadAgentsForSDK } from '../../../services/extensions/extension-sync.js';
import { randomUUID } from 'crypto';

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
  delete sdkOptions.images;     // 图片数据在 DockerExecutor 中处理
  delete sdkOptions.imagePaths; // 图片路径在脚本中单独处理

  // 设置默认工具，如果最终没有配置任何工具
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [
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
    console.log('[ScriptBuilder] Setting default allowedTools');
  }

  // 关键修复：设置 settingSources 以从文件系统加载扩展
  // 根据 Claude Agent SDK 文档，必须显式设置此选项才能加载扩展
  // - "user": 从 ~/.claude/ 加载（HOME 环境变量指向的目录）
  // - "project": 从当前工作目录的 .claude/ 加载
  //
  // SDK 将自动从以下位置加载：
  // - settings.json (包含 customAgents 配置，直接注册无需前缀)
  // - CLAUDE.md (上下文文档)
  // - skills/ (技能目录)
  // - agents/ (代理目录)
  // - commands/ (命令目录)
  // - hooks/ (钩子目录)
  // - knowledge/ (知识目录)
  sdkOptions.settingSources = ['user', 'project'];
  console.log('[ScriptBuilder] Setting settingSources: user, project');

  // 动态加载 agents 和配置 plugins（从 extensions/.claude/ 目录）
  // 注意：skills 不能通过 sdkOptions.skills 传递给子 agents
  // 必须使用 plugins 让 SDK 自动扫描，这样主对话和子 agents 都能使用 skills
  if (options.enableExtensions !== false) {
    try {
      // 动态加载 agents（从 .md 文件读取）
      sdkOptions.agents = await loadAgentsForSDK();
      console.log('[ScriptBuilder] Loaded agents:', Object.keys(sdkOptions.agents));

      // 配置 plugins 指向 skills 目录
      // SDK 会自动扫描 plugins 目录下的 skills，主对话和子 agents 都能使用
      sdkOptions.plugins = [
        {
          type: 'local',
          path: '/workspace/.claude'
        }
      ];
      console.log('[ScriptBuilder] Configured plugins for skills scanning');
    } catch (error) {
      console.error('[ScriptBuilder] Failed to load extensions:', error);
      // 如果加载失败，设置为空
      sdkOptions.agents = {};
      sdkOptions.plugins = [];
    }
  }

  // 定义系统级禁用的交互式规划工具（前端暂不支持）
  // 这些工具需要用户实时交互，Web 界面暂时不支持
  const interactivePlanningTools = [
    'EnterPlanMode',   // 进入规划模式
    'AskUserQuestion', // 向用户提问
    'ExitPlanMode'     // 退出规划模式
  ];

  // 处理权限模式
  // 优先级：前端传入的 permissionMode > 用户设置的 skipPermissions > 默认值
  // 注意：只有用户设置的 disallowedTools 才会影响 bypassPermissions 模式
  // 系统级禁用（interactivePlanningTools）不影响权限模式选择

  // 提取用户设置的禁止工具（不包括系统级的 interactivePlanningTools）
  const userDisallowedTools = sdkOptions.disallowedTools
    ? sdkOptions.disallowedTools.filter(tool => !interactivePlanningTools.includes(tool))
    : [];
  const hasUserDisallowedTools = userDisallowedTools.length > 0;

  // 跟踪是否使用了默认工具列表
  const usingDefaultTools = !sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0;

  // 如果前端明确传入了 permissionMode，使用前端传入的值
  if (sdkOptions.permissionMode) {
    // 如果前端要求 bypassPermissions 但存在用户设置的禁止工具，发出警告
    if (sdkOptions.permissionMode === 'bypassPermissions' && hasUserDisallowedTools) {
      console.warn('[ScriptBuilder] WARNING: bypassPermissions mode will disable user-set disallowedTools:', userDisallowedTools);
    }
    console.log('[ScriptBuilder] Using frontend permissionMode:', sdkOptions.permissionMode);
  }
  // 如果用户设置 skipPermissions 为 true，且没有用户设置的禁止工具，则使用 bypassPermissions
  else if (settings.skipPermissions && !hasUserDisallowedTools) {
    sdkOptions.permissionMode = 'bypassPermissions';
    console.log('[ScriptBuilder] Setting permissionMode: bypassPermissions (reason: skipPermissions=true, no user disallowedTools)');
  }
  // 新增：如果使用默认工具列表且没有用户设置的禁止工具，则使用 bypassPermissions
  // 这样新用户可以直接使用所有预配置的工具（包括 PDF 转换等）
  else if (usingDefaultTools && !hasUserDisallowedTools) {
    sdkOptions.permissionMode = 'bypassPermissions';
    console.log('[ScriptBuilder] Setting permissionMode: bypassPermissions (reason: using default tools, no user disallowedTools)');
  }
  // 其他情况（包括有用户设置禁止工具的情况），使用 default 模式
  else {
    sdkOptions.permissionMode = 'default';
    console.log('[ScriptBuilder] Setting permissionMode: default (reason: ',
      hasUserDisallowedTools ? 'has user disallowedTools' : 'default fallback',
      ')');
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

  // 合并系统级和用户级的 disallowedTools
  // 用户设置的禁止工具优先保留，然后添加系统级禁用工具
  sdkOptions.disallowedTools = [...userDisallowedTools, ...interactivePlanningTools];
  console.log('[ScriptBuilder] Disallowed interactive planning tools:', interactivePlanningTools);
  if (userDisallowedTools.length > 0) {
    console.log('[ScriptBuilder] User disallowed tools:', userDisallowedTools);
  }

  // 移除 sessionId（SDK 不需要这个参数）
  delete sdkOptions.sessionId;

  // 处理 model 参数：如果是 "custom"，则从环境变量读取
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }

  // 调试：检查返回前的 sdkOptions keys
  console.log('[ScriptBuilder] Returning sdkOptions keys:', Object.keys(sdkOptions));

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
  console.log('[ScriptBuilder] Image paths received:', imagePaths);

  // 过滤并处理 options（现在是异步的）
  const sdkOptions = await filterSDKOptions(options, userId);

  // 调试：打印 options 摘要
  console.log('[ScriptBuilder] Original sdkOptions.model:', sdkOptions.model);
  const optionsJsonLength = JSON.stringify(sdkOptions).length;
  console.log(`[ScriptBuilder] optionsJson size: ${optionsJsonLength} bytes`);

  // 使用 base64 编码来避免转义问题
  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

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
    console.error("[SDK] - ANTHROPIC_AUTH_TOKEN:", process.env.ANTHROPIC_AUTH_TOKEN ? "SET (" + process.env.ANTHROPIC_AUTH_TOKEN.substring(0, 10) + "...)" : "NOT SET");
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

