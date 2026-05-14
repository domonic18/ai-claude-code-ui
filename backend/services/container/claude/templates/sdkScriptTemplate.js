/**
 * SDK Script Template
 *
 * Template for the Node.js script that executes in the container
 * @module container/claude/templates/sdkScriptTemplate
 */

import { generateCanUseToolCallback } from './canUseToolTemplate.js';

/**
 * Generate signature stripping code for cross-provider model switching.
 *
 * When resuming a session that was created with a different provider
 * (e.g. MiniMax → Claude), the thinking block signatures from the previous
 * provider are invalid for the new one, causing 400 errors:
 *   "Invalid signature in thinking block"
 *
 * This code runs before the SDK query() call and strips all `signature`
 * fields from thinking blocks in the session JSONL transcript.
 *
 * @returns {string} Signature stripping code
 */
function generateSignatureStrip() {
  return `    // 跨 provider 恢复会话时，清理 thinking block 中的 signature 字段
    // 不同 provider 生成的 signature 无法被另一个 provider 验证
    if (options.resume) {
      try {
        const __fs = await import("fs");
        const __path = await import("path");
        const sigHome = process.env.HOME || process.env.CLAUDE_CONFIG_DIR || "/workspace";
        const sigProjDir = __path.join(sigHome, ".claude", "projects");
        if (__fs.existsSync(sigProjDir)) {
          const sigDirs = __fs.readdirSync(sigProjDir, { withFileTypes: true });
          let sigStripped = 0;
          for (const sigDir of sigDirs) {
            if (!sigDir.isDirectory()) continue;
            const sigDirPath = __path.join(sigProjDir, sigDir.name);
            let sigFiles;
            try { sigFiles = __fs.readdirSync(sigDirPath); } catch { continue; }
            for (const sigFile of sigFiles) {
              if (!sigFile.endsWith(".jsonl")) continue;
              const sigFilePath = __path.join(sigDirPath, sigFile);
              let sigContent;
              try { sigContent = __fs.readFileSync(sigFilePath, "utf-8"); } catch { continue; }
              if (!sigContent.includes('"signature"')) continue;
              const sigLines = sigContent.split("\\n");
              let sigModified = false;
              const sigNewLines = sigLines.map(sigLine => {
                if (!sigLine.includes('"signature"')) return sigLine;
                try {
                  const sigObj = JSON.parse(sigLine);
                  if (sigObj.message && Array.isArray(sigObj.message.content)) {
                    const sigFiltered = sigObj.message.content.filter(sigBlock => sigBlock.type !== "thinking");
                    if (sigFiltered.length !== sigObj.message.content.length) {
                      sigModified = true;
                      // 如果移除 thinking 后 content 为空，跳过此行（返回空字符串占位）
                      if (sigFiltered.length === 0) return '';
                      sigObj.message.content = sigFiltered;
                      return JSON.stringify(sigObj);
                    }
                  }
                } catch {}
                return sigLine;
              }).filter(sigLine => sigLine !== '');
              if (sigModified) {
                __fs.writeFileSync(sigFilePath, sigNewLines.join("\\n"), "utf-8");
                sigStripped++;
              }
            }
          }
          if (sigStripped > 0) {
            console.error("[SDK] Stripped thinking signatures from " + sigStripped + " transcript file(s)");
          }
        }
      } catch (sigErr) {
        console.error("[SDK] Warning: signature strip failed:", sigErr.message);
      }
    }`;
}

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

${generateSignatureStrip()}

    const result = query({
      prompt: command,
      options: options
    });
    console.error("[SDK_PERF] api_call_start:" + Date.now());
    console.error("[SDK] Query started, waiting for chunks...");

    let chunkCount = 0;
    for await (const chunk of result) {
      chunkCount++;
      if (chunkCount === 1) console.error("[SDK_PERF] first_chunk:" + Date.now());
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

${generateCleanup(tmpOptionsFile, tmpScriptFile)}

${generateErrorHandling(tmpOptionsFile, tmpScriptFile)}
}

execute();
`;
}
