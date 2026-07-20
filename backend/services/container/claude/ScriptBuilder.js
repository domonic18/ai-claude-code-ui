/**
 * Claude SDK 脚本生成器
 *
 * 负责生成在容器内执行的 Node.js 脚本。
 * @module container/claude/ScriptBuilder
 */

import { loadAgentsForSDK } from '../../../services/extensions/extension-sync.js';
import { randomUUID } from 'crypto';
import { createLogger, startTimer } from '../../../utils/logger.js';
import { generateSDKScript } from './templates/sdkScriptTemplate.js';
import { determinePermissionMode } from './helpers/permissionModeHelper.js';
import { mergeUserSettings } from './helpers/userSettingsMerger.js';
import { cleanupSdkOptions } from './helpers/sdkOptionCleaner.js';

const logger = createLogger('container/claude/ScriptBuilder');

/** 默认允许的工具列表 */
const DEFAULT_ALLOWED_TOOLS = [
  'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(git status:*)',
  'Bash(cp:*)', 'Bash(mkdir:*)',
  'Bash(pdftotext:*)', 'Bash(pandoc:*)', 'Bash(file:*)',
  'Write', 'Read', 'Edit', 'Glob', 'Grep', 'MultiEdit',
  'Task', 'TodoWrite', 'TodoRead', 'WebFetch', 'WebSearch', 'Skill',
  'AskUserQuestion'
];

/**
 * 设置默认工具列表
 * @param {object} sdkOptions
 */
function setDefaultTools(sdkOptions) {
  if (!sdkOptions.allowedTools || sdkOptions.allowedTools.length === 0) {
    sdkOptions.allowedTools = [...DEFAULT_ALLOWED_TOOLS];
  }
}

/**
 * 应用前端 toolsSettings 覆盖到 sdkOptions
 * @param {object} sdkOptions
 * @param {object} settings
 */
function applyFrontendOverrides(sdkOptions, settings) {
  if (settings.allowedTools?.length > 0) sdkOptions.allowedTools = settings.allowedTools;
  if (settings.disallowedTools?.length > 0) sdkOptions.disallowedTools = settings.disallowedTools;
}

/**
 * 配置扩展加载（agents 和 plugins）
 * @param {object} sdkOptions
 * @param {object} options
 */
async function configureExtensions(sdkOptions, options) {
  sdkOptions.settingSources = ['user', 'project'];

  if (options.enableExtensions === false) return;

  const extTimer = startTimer('sdk/extension_load');
  try {
    sdkOptions.agents = await loadAgentsForSDK();
    sdkOptions.plugins = [{ type: 'local', path: '/workspace/.claude' }];
    extTimer.end(logger, 'Extensions loaded', { agentCount: Object.keys(sdkOptions.agents || {}).length });
  } catch (error) {
    extTimer.endWarn(logger, 'Extensions load failed');
    logger.error({ error }, 'Failed to load extensions');
    sdkOptions.agents = {};
    sdkOptions.plugins = [];
  }
}

/**
 * 自主执行模式的系统提示词规则
 *
 * @type {string[]}
 */
const AUTONOMOUS_MODE_RULES = [
  '## 自主执行模式（AUTONOMOUS MODE）',
  '当前处于无限制自主执行模式，你必须严格遵守以下规则：',
  '1. **禁止提问用户**：不要输出任何需要用户回复的问题，包括但不限于"是否继续？"、"需要我继续吗？"、"请确认"等表述。',
  '2. **禁止等待确认**：不要在任何阶段暂停等待用户确认，直接执行下一步。',
  '3. **完整执行所有任务**：遇到需要分步骤执行的长任务时，自动依次完成所有步骤，不要因为"进度汇报"而中断执行。绝对不要在中间阶段停下来汇报进度后就结束——必须继续执行剩余阶段。',
  '4. **禁止使用 AskUserQuestion 工具**：不要调用 AskUserQuestion 向用户提问。',
  '5. **遇到问题自行决策**：遇到歧义或选择时，基于上下文自行做出最合理的判断并继续执行，不要停下来询问用户。',
  '6. **持续执行直到全部完成**：只有当所有任务都真正完成后才输出最终结果。如果任务分为多个阶段（如阶段1到阶段N），你必须完成所有阶段，不能在中间某个阶段结束后就停止。',
  '7. **禁止输出"断点续传"或"可从中断处继续"的提示**：这意味着你还有未完成的工作，应该继续执行而不是停下来告诉用户可以恢复。',
  '8. **禁止退化循环**：如果你发现自己正在重复输出相同或高度相似的文本（如反复输出"完成""最后""全部完成"等），立即停止该模式。检查 TodoWrite 列表确认当前进度，然后执行下一个未完成的步骤。如果所有步骤都已完成，直接输出最终结果即可，不要反复确认。',
  '9. **编排层保持轻量**：当你通过 Task 工具调度子任务时，你的职责是"读 Task 返回的摘要 → 更新 TodoWrite → 调度下一个 Task"。不要重新输出或总结子任务的详细内容。Task 返回的摘要信息足以供你做决策。',
  '10. **每步检查 TodoWrite**：每完成一个 Task 调用后，立即将对应的 Todo 项标记为 completed，然后查看下一个 pending 项。这确保你始终知道下一步该做什么，而不是重复已完成的步骤。',
  '11. **安全边界**：禁止执行明确的破坏性操作，包括但不限于 `rm -rf /`、`DROP TABLE`、格式化磁盘等不可恢复的命令。如需清理文件，仅允许针对具体的目标路径操作，禁止使用通配符删除系统目录。',
];

/**
 * 装配 systemPrompt.append：合并系统上下文分片（cwd/user-prompt/project-prompt/文档索引/文件读取/skill）
 * 与自主执行模式规则（bypassPermissions 时）。
 *
 * 使用 SDK 的 systemPrompt.append 机制，在默认 claude_code 提示词后追加指令。
 * 仅在存在追加内容时设置 systemPrompt，否则保持 SDK 默认。
 * 装配后清除非合法的 systemContextParts 字段，避免透传给 SDK。
 *
 * @param {object} sdkOptions - SDK 选项（可变）
 * @param {object} options - 原始选项（用于日志 sessionId）
 * @param {number} userId - 用户 ID（日志）
 */
function assembleSystemPrompt(sdkOptions, options, userId) {
  const appendParts = [];

  // 各层累积的系统上下文分片（来自 chat.js / ClaudeQuery.js / buildSDKScript）
  if (Array.isArray(sdkOptions.systemContextParts) && sdkOptions.systemContextParts.length > 0) {
    appendParts.push(...sdkOptions.systemContextParts);
  }

  // bypassPermissions 模式下追加自主执行指令，防止 AI 中途停下来提问
  if (sdkOptions.permissionMode === 'bypassPermissions') {
    appendParts.push(AUTONOMOUS_MODE_RULES.join('\n'));
    logger.info({
      userId,
      sessionId: options.sessionId || '',
      permissionMode: 'bypassPermissions',
    }, '[ScriptBuilder] Autonomous mode activated (bypassPermissions)');
  }

  if (appendParts.length > 0) {
    sdkOptions.systemPrompt = {
      type: 'preset',
      preset: 'claude_code',
      append: appendParts.join('\n\n'),
    };
  }

  // systemContextParts 非合法 SDK 选项，装配完毕后清除
  delete sdkOptions.systemContextParts;
}

/**
 * 过滤 SDK 选项
 * @param {object} options
 * @param {number} userId
 * @returns {Promise<object>}
 */
async function filterSDKOptions(options, userId) {
  const sdkOptions = { ...options };
  const settings = options.toolsSettings || {};

  await mergeUserSettings(sdkOptions, settings, userId);
  applyFrontendOverrides(sdkOptions, settings);
  setDefaultTools(sdkOptions);
  await configureExtensions(sdkOptions, options);

  // 开启逐 token 流式（容器路径 ClaudeQuery→ScriptBuilder 实际生效处）。
  // 注意：OptionsMapper.mapCliOptionsToSDK 是另一条(ClaudeExecutor)路径，不经过容器，
  // 所以必须在此处再设一次，否则 includePartialMessages 进不了沙箱、deltas 恒为 0。
  // 让 SDK yield stream_event(text delta)，首字从 message 级(~10s+)提前到接近 TTFT(~2s)。
  // 前提：provider 端点真流式（moonshot 直连已用 curl 验证 ✅）。
  sdkOptions.includePartialMessages = true;

  const userDisallowedTools = determinePermissionMode(sdkOptions, settings);
  cleanupSdkOptions(sdkOptions, options, userDisallowedTools);

  // ── Extended thinking：env 优先级最高（运维刹车），其次 per-request ──
  // 决策矩阵：
  //   env DISABLE_THINKING=1                  → thinking={type:'disabled'}  source='env'        （前端无效）
  //   env 未设 + req.extendedThinking===false → thinking={type:'disabled'}  source='req-off'
  //   env 未设 + req.extendedThinking true|undefined → 不设字段（走模型默认） source='req-on'|'default'
  const envDisable = process.env.DISABLE_THINKING === '1';
  const reqThinking = options.extendedThinking;          // undefined | true | false
  let thinkingSource;
  if (envDisable) {
    sdkOptions.thinking = { type: 'disabled' };
    thinkingSource = 'env';
  } else if (reqThinking === false) {
    sdkOptions.thinking = { type: 'disabled' };
    thinkingSource = 'req-off';
  } else {
    delete sdkOptions.thinking;                           // 走模型默认（不传 thinking 字段）
    thinkingSource = (reqThinking === true) ? 'req-on' : 'default';
  }
  delete sdkOptions.extendedThinking;                     // meta 字段，不可泄漏进 SDK
  logger.info({
    sessionId: options.sessionId || '',
    source: thinkingSource,
    thinking: sdkOptions.thinking ?? null,
    envDisable,
    reqThinking: reqThinking ?? null,
  }, '[ScriptBuilder] Extended thinking decision');

  // 装配 systemPrompt.append（系统上下文分片 + 自主模式规则）
  assembleSystemPrompt(sdkOptions, options, userId);

  return sdkOptions;
}

/**
 * 生成 SDK 执行脚本
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {number} userId - 用户 ID
 * @returns {Promise<object>}
 */
export async function buildSDKScript(command, options, userId) {
  const sessionId = options.sessionId || '';
  const imagePaths = options.imagePaths || [];

  // 用户手动选择的 skill：触发行放回用户消息（需与用户原话同处，才能指代如"这个技能"）。
  // 用 <ccui-inject> 包裹，前端 extractUserContent 显示时剥掉，保持气泡干净。
  // 注：skill 与 cwd/索引/用户提示词等 ambient 上下文不同——它是"本次请求用哪个技能"的直接指令，
  // 不能进 system prompt（否则与用户原话分离，模型无法解析指代）。
  if (options.skill) {
    // 校验 skill 名称：只允许字母、数字、连字符、下划线，防止注入
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(options.skill)) {
      throw new Error(`Invalid skill name: ${options.skill}`);
    }
    command = `<ccui-inject type="skill">请使用 "${options.skill}" skill 完成此任务。</ccui-inject>\n\n${command}`;
    logger.info({ skill: options.skill }, '[ScriptBuilder] Skill explicitly selected by user');
  }

  const sdkOptions = await filterSDKOptions(options, userId);

  logger.debug({ model: sdkOptions.model }, 'sdkOptions.model');
  logger.debug({ size: JSON.stringify(sdkOptions).length }, 'optionsJson size');

  logger.info({
    model: sdkOptions.model,
    permissionMode: sdkOptions.permissionMode,
    allowDangerouslySkipPermissions: sdkOptions.allowDangerouslySkipPermissions,
    thinking: sdkOptions.thinking ?? 'unset',
    optionsSize: JSON.stringify(sdkOptions).length,
  }, '[ScriptBuilder] SDK options summary');

  // ── Prompt 可观测性 ──────────────────────────────────────
  // 默认仅记录结构信息（长度/是否注入）；对话内容属敏感数据，遵循日志规范默认不打印。
  // 排障时设置环境变量 LOG_FULL_PROMPT=1，可打印完整 user prompt 与 systemPrompt.append。
  const fullPromptDebug = process.env.LOG_FULL_PROMPT === '1';
  const spAppend = sdkOptions.systemPrompt?.append;
  logger.info({
    sessionId,
    commandLength: command.length,
    hasSystemPrompt: !!sdkOptions.systemPrompt,
    systemPromptAppendLength: typeof spAppend === 'string' ? spAppend.length : 0,
    systemContextPartsCount: Array.isArray(options.systemContextParts) ? options.systemContextParts.length : 0,
    fullPromptLogging: fullPromptDebug,
  }, '[ScriptBuilder] Prompt summary（command=用户原话；上下文经 systemPrompt.append 注入）');
  if (fullPromptDebug) {
    logger.info({ sessionId, prompt: command }, '[ScriptBuilder][FULL_PROMPT] user prompt（应为用户原话，不含任何注入）');
    logger.info({ sessionId, systemPrompt: sdkOptions.systemPrompt }, '[ScriptBuilder][FULL_PROMPT] systemPrompt（preset + append，含 cwd/索引/文件/skill/user-prompt/project-prompt）');
  }

  const optionsBase64 = Buffer.from(JSON.stringify(sdkOptions)).toString('base64');
  const commandBase64 = Buffer.from(command, 'utf-8').toString('base64');

  const BASE64_SAFE = /^[A-Za-z0-9+/=]+$/;
  if (!BASE64_SAFE.test(commandBase64)) throw new Error('commandBase64 contains non-standard base64 characters');
  if (!BASE64_SAFE.test(optionsBase64)) throw new Error('optionsBase64 contains non-standard base64 characters');

  const tmpId = randomUUID();
  const tmpOptionsFile = `/tmp/sdk_opts_${tmpId}.b64`;
  const tmpScriptFile = `/tmp/sdk_exec_${tmpId}.mjs`;

  const scriptContent = generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths, sdkOptions.permissionMode);

  return { scriptContent, optionsBase64, tmpOptionsFile, tmpScriptFile };
}
