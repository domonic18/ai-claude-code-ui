/**
 * SDK Script Template
 *
 * Template for the Node.js script that executes in the container
 * @module container/claude/templates/sdkScriptTemplate
 */

import { generateCanUseToolCallback } from './canUseToolTemplate.js';

/**
 * Generate image handling code section
 * @param {Array} imagePaths - Array of image paths
 * @returns {string} Image handling code
 */
function generateImageHandling(imagePaths) {
  const pathsArray = JSON.stringify(imagePaths);
  return `    // 添加图片路径到命令（如果有）
    const imagePaths = ${pathsArray};
    if (imagePaths.length > 0) {
      console.error("[SDK] Images available at:", imagePaths);
      const imageNote = "\\n\\n[Images provided at the following paths:]\\n" +
        imagePaths.map((p, i) => (i + 1) + ". " + p).join("\\n") +
        "\\n\\nPlease use the Read tool to view these images and analyze them.";
      command = command + imageNote;
    }`;
}

/**
 * Generate directory setup code section
 * @returns {string} Directory setup code
 */
function generateDirectorySetup() {
  return `    // 切换到项目目录，确保工具在正确的位置执行
    if (options.cwd) {
      const projectDir = options.cwd;
      console.error("[SDK] Changing CWD to:", projectDir);
      try {
        process.chdir(projectDir);
      } catch (chdirError) {
        console.error("[SDK] Failed to change directory:", chdirError.message);
      }
    }`;
}

/**
 * Generate error handling code section
 * @param {string} tmpOptionsFile - Temporary options file path
 * @param {string} tmpScriptFile - Temporary script file path
 * @returns {string} Error handling code
 */
function generateErrorHandling(tmpOptionsFile, tmpScriptFile) {
  return `  } catch (error) {
    // 使用同步写入 stderr，确保 process.exit 前错误信息一定被输出
    const errMsg = "[SDK] Error occurred: " + (error.message || error) + "\\n";
    const stackMsg = "[SDK] Stack: " + (error.stack || "no stack") + "\\n";
    try { process.stderr.write(errMsg); } catch (e) { /* stderr 不可用时无法写入 */ }
    try { process.stderr.write(stackMsg); } catch (e) { /* stderr 不可用时无法写入 */ }

    // 同时输出到 stdout 以便 dockerStreamHandler 捕获错误
    try {
      process.stdout.write(JSON.stringify({
        type: "error",
        error: error.message || String(error)
      }) + "\\n");
    } catch (e) { process.stderr.write("[SDK] Failed to write error to stdout: " + e.message + "\\n"); }

    // 清理临时文件
    try { unlinkSync("${tmpOptionsFile}"); } catch (e) { process.stderr.write("[SDK] Cleanup failed: " + e.message + "\\n"); }
    try { unlinkSync("${tmpScriptFile}"); } catch (e) { process.stderr.write("[SDK] Cleanup failed: " + e.message + "\\n"); }

    // 等待 500ms 让 stderr 刷新完毕再退出
    setTimeout(() => process.exit(1), 500);
  }`;
}

/**
 * Generate cleanup code section
 * @param {string} tmpOptionsFile - Temporary options file path
 * @param {string} tmpScriptFile - Temporary script file path
 * @returns {string} Cleanup code
 */
function generateCleanup(tmpOptionsFile, tmpScriptFile) {
  return `    // 清理临时文件
    try { unlinkSync("${tmpOptionsFile}"); } catch {}
    try { unlinkSync("${tmpScriptFile}"); } catch {}`;
}

/** 允许的 permissionMode 枚举值 */
const VALID_PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];

/**
 * 合法 sessionId 字符集——只允许字母/数字/连字符/下划线（可为空串）。
 * 目的：sessionId 会直接 ${} 嵌入下方模板字符串，此处白名单阻止
 * 引号/反斜杠/$/反引号等字符导致的脚本注入。
 * 兼容 UUID、`temp-` 前缀临时 ID、空串等后端实际使用的格式。
 */
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]*$/;

/**
 * Generate SDK script content
 * @param {string} tmpOptionsFile - Temporary options file path
 * @param {string} tmpScriptFile - Temporary script file path
 * @param {string} commandBase64 - Base64 encoded command
 * @param {string} sessionId - Session ID
 * @param {Array} imagePaths - Array of image paths
 * @param {string} permissionMode - Permission mode ('default' | 'acceptEdits' | 'bypassPermissions' | 'plan')
 * @returns {string} Script content
 */
export function generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths, permissionMode = 'default') {
  if (!VALID_PERMISSION_MODES.includes(permissionMode)) {
    throw new TypeError(`Invalid permissionMode: "${permissionMode}". Must be one of: ${VALID_PERMISSION_MODES.join(', ')}`);
  }
  // 白名单校验：sessionId 嵌入模板字符串前拦截注入字符（见 SAFE_SESSION_ID）
  if (typeof sessionId !== 'string' || !SAFE_SESSION_ID.test(sessionId)) {
    throw new TypeError('Invalid sessionId: must contain only alphanumeric characters, hyphens, or underscores');
  }
  const autoAnswer = permissionMode === 'bypassPermissions';

  return `import { query } from "/app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";
import { readFileSync, unlinkSync } from "fs";

async function execute() {
  try {
    console.error("[SDK_PERF] script_start:" + Date.now());
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

${generateImageHandling(imagePaths)}

    console.error("[SDK] Options model:", options.model);
    console.error("[SDK] Options permissionMode:", options.permissionMode);
    console.error("[SDK] Options allowDangerouslySkipPermissions:", options.allowDangerouslySkipPermissions);
    console.error("[SDK] Command:", command);

${generateDirectorySetup()}

${generateCanUseToolCallback(autoAnswer)}

    // Claude SDK 接受一个对象参数：{ prompt, options }
    // 注入 canUseTool 回调以拦截 AskUserQuestion
    options.canUseTool = canUseTool;

    const result = query({
      prompt: command,
      options: options
    });
    console.error("[SDK_PERF] api_call_start:" + Date.now());
    console.error("[SDK] Query started, waiting for chunks...");

    let chunkCount = 0;
    let deltaCount = 0;
    const evtFirstSeen = {};
    const evtCount = {};
    for await (const chunk of result) {
      chunkCount++;
      if (chunkCount === 1) console.error("[SDK_PERF] first_chunk:" + Date.now());

      // 逐 token 流式：includePartialMessages 开启后，SDK 会 yield type='stream_event'，
      // 其 event 是 Anthropic 原始 SSE 事件（content_block_delta/message_start/ping/...）。
      // 全部走 stream_event 专用通道交给后端解析：后端只把 content_block_delta 的 text
      // 转发为 stream-delta，其余忽略。绝不能混入 content——否则每个事件都会被
      // handleDefaultMessage 当 claude-response 灌爆前端（实测一次会话涌出上万条）。
      if (chunk && chunk.type === "stream_event") {
        deltaCount++;
        const et = (chunk.event && chunk.event.type) || "unknown";
        evtCount[et] = (evtCount[et] || 0) + 1;
        // 诊断：首次见到每种事件类型时 dump 一次结构（定位文本增量到底在哪个字段）
        if (!evtFirstSeen[et]) {
          evtFirstSeen[et] = true;
          console.error("[SDK] EVT_SAMPLE[" + et + "] " + JSON.stringify(chunk.event).slice(0, 350));
        }
        console.log(JSON.stringify({ type: "stream_event", event: chunk.event }));
        continue;
      }

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

    console.error("[SDK] EVT_DIST " + JSON.stringify(evtCount));
    console.error("[SDK] Query complete, total chunks:", chunkCount, "deltas:", deltaCount);
    console.log(JSON.stringify({
      type: "done",
      sessionId: "${sessionId}"
    }));

${generateCleanup(tmpOptionsFile, tmpScriptFile)}

    process.exit(0);
${generateErrorHandling(tmpOptionsFile, tmpScriptFile)}
}

try {
  await execute();
} catch (err) {
  console.error("[SDK] Fatal error:", err);
  process.exit(1);
}
`;
}
