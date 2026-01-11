/**
 * Claude SDK 脚本生成器
 * 
 * 负责生成在容器内执行的 Node.js 脚本。
 */

/**
 * 过滤 SDK 选项，移除不需要传给 SDK 的字段
 * @param {object} options - 原始选项
 * @returns {object} 过滤后的选项
 */
function filterSDKOptions(options) {
  const sdkOptions = { ...options };
  
  // 移除不需要传给 SDK 的字段
  delete sdkOptions.userId;
  delete sdkOptions.isContainerProject;
  delete sdkOptions.projectPath;
  
  // 处理 model 参数：如果是 "custom"，则从环境变量读取
  if (sdkOptions.model === 'custom') {
    delete sdkOptions.model;
  }
  
  return sdkOptions;
}

/**
 * 转义命令字符串
 * @param {string} command - 原始命令
 * @returns {string} 转义后的命令
 */
function escapeCommand(command) {
  return command
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

/**
 * 生成 SDK 执行脚本
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @returns {string} 完整的 Node.js 执行脚本
 */
export function buildSDKScript(command, options) {
  // 提取 sessionId 以便在脚本中使用
  const sessionId = options.sessionId || '';
  
  // 过滤并处理 options
  const sdkOptions = filterSDKOptions(options);
  
  // 使用 base64 编码来避免转义问题
  const optionsJson = JSON.stringify(sdkOptions);
  const optionsBase64 = Buffer.from(optionsJson).toString('base64');
  
  // 转义命令
  const escapedCommand = escapeCommand(command);

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
    
    console.error("[SDK] Options:", JSON.stringify(options, null, 2));
    console.error("[SDK] Command:", "${escapedCommand}");
    
    // Claude SDK 接受一个对象参数：{ prompt, options }
    const result = query({
      prompt: "${escapedCommand}",
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

