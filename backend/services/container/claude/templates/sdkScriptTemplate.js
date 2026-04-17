/**
 * SDK Script Template
 *
 * Template for the Node.js script that executes in the container
 * @module container/claude/templates/sdkScriptTemplate
 */

/**
 * Generate SDK script content
 * @param {string} tmpOptionsFile - Temporary options file path
 * @param {string} tmpScriptFile - Temporary script file path
 * @param {string} commandBase64 - Base64 encoded command
 * @param {string} sessionId - Session ID
 * @param {Array} imagePaths - Array of image paths
 * @returns {string} Script content
 */
export function generateSDKScript(tmpOptionsFile, tmpScriptFile, commandBase64, sessionId, imagePaths) {
  return `import { query } from "/app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";
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
}
