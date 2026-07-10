/**
 * Docker 执行引擎
 *
 * 负责在 Docker 容器内执行脚本并处理流式输出。
 */

import containerManager from '../core/index.js';
import { buildSDKScript } from './ScriptBuilder.js';
import { setSessionStream, setSessionStdin, setSessionKillFn } from './SessionManager.js';
import { writeFileViaPutArchive } from '../utils/containerFileWriter.js';
import { createLogger, sanitizePreview, startTimer } from '../../../utils/logger.js';
import { copyImagesToContainer } from './dockerImageHandler.js';
import { handleStreamProcessing } from './dockerStreamHandler.js';
import { CONTAINER } from '../../../config/config.js';

const logger = createLogger('services/container/claude/DockerExecutor');

/**
 * 准备容器并构建 SDK 脚本
 * @param {string} userId - 用户 ID
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {{baseURL: string, authToken: string, apiKey: string}} providerConfig - Provider 端点配置
 * @returns {Promise<{container: object, docker: object, sdkScriptInfo: object, providerConfig: object}>}
 */
async function prepareContainerAndScript(userId, command, options, providerConfig) {
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
    imagePaths = await copyImagesToContainer(container, options.images, options.cwd || CONTAINER.paths.workspace, logger);
  }

  // 构建 SDK 脚本
  const sdkScriptInfo = await buildSDKScript(command, { ...options, imagePaths }, userId);

  // 验证 provider 配置中包含认证信息
  if (!providerConfig.authToken) {
    throw new Error('No auth token found for model provider. Check PROVIDER_* env vars or ANTHROPIC_AUTH_TOKEN.');
  }

  // 写入脚本和选项文件到容器
  const uploadTimer = startTimer('sdk/script_upload');
  await writeFileViaPutArchive(container, sdkScriptInfo.tmpOptionsFile, sdkScriptInfo.optionsBase64, { logLabel: 'DockerExecutor' });
  await writeFileViaPutArchive(container, sdkScriptInfo.tmpScriptFile, sdkScriptInfo.scriptContent, { logLabel: 'DockerExecutor' });
  uploadTimer.end(logger, 'Script files uploaded to container');

  return { container, docker, sdkScriptInfo, providerConfig };
}

/**
 * 在容器内执行 SDK 脚本
 * @param {string} userId - 用户 ID
 * @param {string} command - 用户命令
 * @param {object} options - SDK 选项
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {{baseURL: string, authToken: string, apiKey: string}} [providerConfig] - Provider 端点配置
 * @returns {Promise<object>} 执行结果 { output, sessionId }
 */
export async function executeInContainer(userId, command, options, writer, sessionId, providerConfig) {
  const execTimer = startTimer('docker/exec');
  logger.info({ sessionId, userId, cwd: options.cwd }, '[DockerExecutor] Starting execution');
  logger.debug({ preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[DockerExecutor] User command');

  try {
    // 步骤 1：准备容器和脚本
    const scriptTimer = startTimer('claude/script_build');
    const { docker, sdkScriptInfo, providerConfig: resolvedConfig } = await prepareContainerAndScript(userId, command, options, providerConfig);
    scriptTimer.end(logger, 'Script prepared', { sessionId, scriptSize: sdkScriptInfo.scriptContent.length });

    // 步骤 2：在容器中执行脚本（启用 stdin 以支持 Agent 交互提问）
    const spawnTimer = startTimer('claude/docker_exec_spawn');
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
          ANTHROPIC_AUTH_TOKEN: resolvedConfig.authToken,
          ANTHROPIC_BASE_URL: resolvedConfig.baseURL,
          ANTHROPIC_API_KEY: resolvedConfig.apiKey,
          // Claude CLI 拒绝在 root 用户下使用 bypassPermissions，
          // 设置 IS_SANDBOX=1 告知 CLI 当前运行在沙箱容器中（参考 cli.js:11106430）
          IS_SANDBOX: '1'
        }
      }
    );
    spawnTimer.end(logger, 'Docker exec stream obtained', { sessionId });

    // 步骤 3：保存 stream 并设置多路分离
    setSessionStream(sessionId, stream);

    // 注册容器内进程 kill 函数：abort 时显式 kill 容器内 SDK 进程组。
    // 非 TTY 模式下 destroy stream 不杀进程，必须显式 kill；且要杀进程组而非单个进程——
    // SDK 的 query() 会 spawn 一个 [claude] CLI 子进程，若只 pkill sdk_exec 父进程，
    // CLI 子进程会变孤儿（PPID→1）继续执行，导致停止后文档仍持续生成。
    setSessionKillFn(sessionId, async () => {
      const tmpScriptFile = sdkScriptInfo.tmpScriptFile;
      logger.info({ sessionId, tmpScriptFile }, '[DockerExecutor] Killing container SDK process group on abort');
      try {
        // shell 单引号转义：单引号内 sh 不解释任何元字符（$ ` " \），嵌入的单引号需转义为 '\''
        // 防御命令注入——tmpScriptFile 虽是 randomUUID 路径（无元字符），仍转义兜底
        const safePattern = `'${String(tmpScriptFile).replace(/'/g, `'\\''`)}'`;
        // 进程组 kill：sdk_exec 是进程组 leader（PGID=PID），kill -TERM -<pgid> 杀整组（sdk_exec + claude 子进程）。
        // pgrep 定位 sdk_exec 的 PID（即 PGID），负号 -<pgid> 表示向整个进程组发 SIGTERM。
        // 末尾 true 保证命令返回 0（无匹配/kill 失败也不抛错），避免 exec stream 异常。
        const { stream: killStream } = await containerManager.execInContainer(
          userId,
          ['sh', '-c', `pgid=$(pgrep -f ${safePattern} | head -1); [ -n "$pgid" ] && kill -TERM -"$pgid" 2>/dev/null; true`],
          { tty: false }
        );
        // 吞掉 kill exec stream 的 error，避免 unhandled；不读输出（只关心信号已发）
        killStream?.on?.('error', () => {});
      } catch (err) {
        // 进程可能已自然退出 / 容器已停——kill 失败不阻断 abort，降级为只 destroy stream
        logger.debug({ err: err?.message || err, sessionId }, '[DockerExecutor] process group kill failed (process may have exited)');
      }
    });

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

    // 检测异常终止（CLI 进程崩溃或 API 连接中断）
    if (result.abnormalTermination) {
      const errorMsg = result.error || 'unknown error';
      logger.error({ sessionId, error: errorMsg }, '[DockerExecutor] SDK process terminated abnormally');
      // 向前端发送错误消息（不暴露内部实现细节）
      if (writer && typeof writer.send === 'function') {
        try {
          writer.send({
            type: 'error',
            sessionId,
            message: '任务执行异常中断，部分文档可能未完成。可通过断点续传继续。',
            code: 'SDK_ABNORMAL_TERMINATION'
          });
        } catch (sendErr) {
          logger.warn({ sessionId, err: sendErr }, '[DockerExecutor] Failed to send error to frontend');
        }
      }
    }

    return result;

  } catch (error) {
    execTimer.endError(logger, 'Docker exec failed', { sessionId });
    logger.error({ sessionId, err: error }, '[DockerExecutor] Exception during execution');
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

