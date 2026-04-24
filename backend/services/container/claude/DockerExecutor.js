/**
 * Docker 执行引擎
 *
 * 负责在 Docker 容器内执行脚本并处理流式输出。
 */

import containerManager from '../core/index.js';
import { buildSDKScript } from './ScriptBuilder.js';
import { setSessionStream, setSessionStdin } from './SessionManager.js';
import { writeFileViaPutArchive } from '../utils/containerFileWriter.js';
import { createLogger, sanitizePreview, startTimer } from '../../../utils/logger.js';
import { copyImagesToContainer } from './dockerImageHandler.js';
import { handleStreamProcessing } from './dockerStreamHandler.js';

const logger = createLogger('services/container/claude/DockerExecutor');

/**
 * 准备容器并构建 SDK 脚本
 * @param {string} userId - 用户 ID
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @returns {Promise<{container: object, docker: object, sdkScriptInfo: object}>}
 */
async function prepareContainerAndScript(userId, command, options) {
  // 获取容器信息
  const containerInfo = containerManager.getContainerByUserId(userId);
  if (!containerInfo) {
    throw new Error(`No container found for user ${userId}`);
  }

  const docker = containerManager.docker;
  const container = docker.getContainer(containerInfo.id);

  // 处理图片
  let imagePaths = [];
  if (options.images?.length > 0) {
    logger.info('[DockerExecutor] Copying', options.images.length, 'images to container...');
    imagePaths = await copyImagesToContainer(container, options.images, options.cwd || '/workspace/my-workspace', logger);
  }

  // 构建 SDK 脚本
  const sdkScriptInfo = await buildSDKScript(command, { ...options, imagePaths }, userId);

  // 验证必需的环境变量
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  if (!authToken) {
    throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY must be set in environment or .env file');
  }

  // 写入脚本和选项文件到容器
  await writeFileViaPutArchive(container, sdkScriptInfo.tmpOptionsFile, sdkScriptInfo.optionsBase64, { logLabel: 'DockerExecutor' });
  await writeFileViaPutArchive(container, sdkScriptInfo.tmpScriptFile, sdkScriptInfo.scriptContent, { logLabel: 'DockerExecutor' });

  return { container, docker, sdkScriptInfo, authToken };
}

/**
 * 在容器内执行 SDK 脚本
 * @param {string} userId - 用户 ID
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object>} 执行结果 { output, sessionId }
 */
export async function executeInContainer(userId, command, options, writer, sessionId) {
  const execTimer = startTimer('docker/exec');
  logger.info({ sessionId, userId, cwd: options.cwd }, '[DockerExecutor] Starting execution');
  logger.debug({ preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[DockerExecutor] User command');

  try {
    // 步骤 1：准备容器和脚本
    const { docker, sdkScriptInfo, authToken } = await prepareContainerAndScript(userId, command, options);

    // 步骤 2：在容器中执行脚本（启用 stdin 以支持 Agent 交互提问）
    const { stream } = await containerManager.execInContainer(
      userId,
      ['node', sdkScriptInfo.tmpScriptFile],
      {
        cwd: '/app',
        tty: false,
        stdin: true,
        env: {
          NODE_PATH: '/app/node_modules',
          HOME: '/workspace',
          CLAUDE_CONFIG_DIR: '/workspace/.claude',
          ANTHROPIC_AUTH_TOKEN: authToken,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL
        }
      }
    );

    // 步骤 3：保存 stream 并设置多路分离
    setSessionStream(sessionId, stream);
    const { PassThrough } = await import('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    docker.modem.demuxStream(stream, stdout, stderr);

    // 保存 stdin 写入函数（用于向前端用户的回答写入容器 stdin）
    // Docker exec stream 在非 TTY 模式下需要使用多路复用协议写入 stdin
    // header: [streamType(1byte), padding(3bytes), size(4bytes)] + payload
    const stdinWriter = (data) => {
      const header = Buffer.alloc(8);
      header[0] = 0; // stdin stream type = 0
      const payload = Buffer.from(data);
      header.writeUInt32BE(payload.length, 4);
      stream.write(Buffer.concat([header, payload]));
    };
    setSessionStdin(sessionId, stdinWriter);

    // 步骤 4：处理流输出并等待结果
    const result = await handleStreamProcessing(stream, stdout, stderr, writer, sessionId);
    execTimer.end(logger, 'Docker exec completed', { sessionId });
    return result;

  } catch (error) {
    execTimer.endError(logger, 'Docker exec failed', { sessionId });
    logger.error({ sessionId, err: error }, '[DockerExecutor] Exception during execution');
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

