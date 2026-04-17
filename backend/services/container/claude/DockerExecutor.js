/**
 * Docker 执行引擎
 *
 * 负责在 Docker 容器内执行脚本并处理流式输出。
 */

import path from 'path';
import fs from 'fs/promises';
import tar from 'tar';
import containerManager from '../core/index.js';
import { buildSDKScript } from './ScriptBuilder.js';
import { processOutput } from './MessageTransformer.js';
import { setSessionStream, getSession } from './SessionManager.js';
import { SDK } from '../../../config/config.js';
import { writeFileViaPutArchive } from '../utils/containerFileWriter.js';
import { createLogger, sanitizePreview } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/DockerExecutor');

/**
 * 检查 stderr 是否包含真正的错误
 * @param {string} stderrOutput - stderr 输出
 * @returns {boolean} 是否包含错误
 */
function hasRealError(stderrOutput) {
  // 识别 Node.js 错误：SyntaxError, ReferenceError, TypeError 等
  // 但排除 SDK 的调试日志（以 "[SDK]" 开头）
  const errorPatterns = [
    /^(?!\[SDK\]).*Error:/m,      // 错误类型（但不是 [SDK] 日志）
    /^\s+at\s+/m,                  // 堆栈跟踪
    /process\.exit\(1\)/           // 进程退出
  ];

  return errorPatterns.some(pattern => pattern.test(stderrOutput));
}

/**
 * 将 base64 图片数据保存到本地临时目录
 * @param {Array} images - 图片附件数组
 * @param {string} tempDir - 临时目录路径
 * @returns {Promise<Array<{localPath: string, containerPath: string, filename: string}>>}
 */
async function saveImagesLocally(images, tempDir) {
  const imagePaths = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      logger.error('[DockerExecutor] Invalid image data format for image', i);
      continue;
    }

    const [, mimeType, base64Data] = matches;
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `image_${i}.${extension}`;
    const filepath = path.join(tempDir, filename);

    await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
    imagePaths.push({
      localPath: filepath,
      containerPath: '', // 稍后设置
      filename
    });
  }

  return imagePaths;
}

/**
 * 创建 tar 归档并上传到容器
 * @param {object} container - Docker 容器实例
 * @param {string} tempDir - 临时目录路径
 * @param {Array} imagePaths - 图片路径信息
 * @param {string} cwd - 容器内工作目录
 */
async function createAndUploadArchive(container, tempDir, imagePaths, cwd) {
  // 创建 images 子目录并移动文件
  const imagesDir = path.join(tempDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  for (const img of imagePaths) {
    const newPath = path.join(imagesDir, img.filename);
    await fs.rename(img.localPath, newPath);
    img.containerPath = `${cwd}/.tmp/images/${img.filename}`;
  }

  // 创建 tar 文件
  const tarPath = path.join(tempDir, 'images.tar');
  await tar.c({ file: tarPath, cwd: tempDir, gzip: false }, ['images']);
  const tarBuffer = await fs.readFile(tarPath);

  // 确保容器内 .tmp 目录存在
  const mkdirExec = await container.exec({
    Cmd: ['mkdir', '-p', `${cwd}/.tmp`],
    AttachStdout: true,
    AttachStderr: true
  });

  await new Promise((resolve, reject) => {
    mkdirExec.start({ Detach: false }, (err, stream) => {
      if (err) { reject(err); return; }
      if (stream) {
        stream.on('close', resolve);
        stream.on('error', reject);
        setTimeout(resolve, 1000);
      } else {
        resolve();
      }
    });
  });

  // 上传 tar 到容器
  await new Promise((resolve, reject) => {
    container.putArchive(tarBuffer, { path: `${cwd}/.tmp` }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 将图片复制到容器内
 * @param {object} container - Docker 容器实例
 * @param {Array} images - 图片附件数组
 * @param {string} cwd - 容器内工作目录
 * @returns {Promise<Array<string>>} 容器内图片路径数组
 */
async function copyImagesToContainer(container, images, cwd) {
  if (!images || images.length === 0) {
    return [];
  }

  const tempDir = path.join(process.cwd(), '.tmp', 'images', Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // 步骤 1：保存图片到本地
    const imagePaths = await saveImagesLocally(images, tempDir);
    if (imagePaths.length === 0) {
      return [];
    }

    // 步骤 2：创建归档并上传
    await createAndUploadArchive(container, tempDir, imagePaths, cwd);

    logger.info('[DockerExecutor] Copied', imagePaths.length, 'images to container');

    // 清理本地临时文件
    await fs.rm(tempDir, { recursive: true, force: true });

    return imagePaths.map(p => p.containerPath);

  } catch (error) {
    logger.error({ err: error }, '[DockerExecutor] Error copying images to container');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(`图片复制到容器失败: ${error.message}`);
  }
}

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
    imagePaths = await copyImagesToContainer(container, options.images, options.cwd || '/workspace/my-workspace');
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
 * 设置流处理并返回 Promise 结果
 * @param {object} stream - Docker exec 流
 * @param {object} stdout - stdout PassThrough 流
 * @param {object} stderr - stderr PassThrough 流
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<object>} 执行结果
 */
function handleStreamProcessing(stream, stdout, stderr, writer, sessionId) {
  const stdoutChunks = [];
  const stderrChunks = [];
  let dataCount = 0;
  const state = { sessionCreatedSent: false };

  // 监听 stdout（SDK 输出）
  stdout.on('data', (chunk) => {
    dataCount++;
    const output = chunk.toString();
    stdoutChunks.push(output);

    if (writer) {
      try {
        processOutput(output, writer, sessionId, state);
      } catch (e) {
        logger.error('[DockerExecutor] Error processing output:', e);
      }
    } else {
      logger.warn('[DockerExecutor] Writer not available');
    }
  });

  // 监听 stderr（错误和调试信息）
  stderr.on('data', (chunk) => {
    const stderrText = chunk.toString();
    stderrChunks.push(stderrText);

    if (hasRealError(stderrText)) {
      logger.error({ sessionId, stderr: stderrText.substring(0, 2000) }, '[DockerExecutor] STDERR error detected');
    } else if (stderrText.startsWith('[SDK]') || stderrText.includes('Error') || stderrText.includes('Exception')) {
      logger.debug({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR debug output');
    }
  });

  return new Promise((resolve, reject) => {
    // 超时保护（可配置，0 表示禁用）
    const timeoutMs = SDK.executionTimeout;
    let timeoutHandle = null;
    let settled = false;

    const settle = (fn, value) => {
      if (!settled) { settled = true; fn(value); }
    };

    if (timeoutMs > 0) {
      const timeoutMinutes = Math.round(timeoutMs / 60000);
      logger.info(`[DockerExecutor] Setting execution timeout: ${timeoutMinutes} minutes`);
      timeoutHandle = setTimeout(() => {
        logger.error(`[DockerExecutor] Execution timeout after ${timeoutMinutes} minutes`);
        stdout.destroy();
        stderr.destroy();
        stream.destroy();
        settle(reject, new Error(`SDK execution timeout (${timeoutMinutes} minutes)`));
      }, timeoutMs);
    } else {
      logger.info('[DockerExecutor] Execution timeout disabled (SDK_EXECUTION_TIMEOUT=0)');
    }

    // 流结束处理
    stream.on('end', () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);

      // 检查会话是否被中止
      const session = getSession(sessionId);
      if (!session && dataCount > 0) {
        logger.info(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
        settle(resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
        return;
      }

      const stdoutOutput = stdoutChunks.join('');
      const stderrOutput = stderrChunks.join('');
      logger.info({ sessionId, totalChunks: dataCount, stdoutLength: stdoutOutput.length, stderrLength: stderrOutput.length }, '[DockerExecutor] Stream ended');

      if (hasRealError(stderrOutput)) {
        logger.error({ sessionId, stderr: stderrOutput.substring(0, 2000) }, '[DockerExecutor] Execution failed');
        settle(reject, new Error(`SDK execution error: ${stderrOutput}`));
      } else {
        logger.info({ sessionId }, '[DockerExecutor] Execution completed successfully');
        settle(resolve, { output: stdoutOutput, sessionId });
      }
    });

    stream.on('error', (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      logger.error({ sessionId, err }, '[DockerExecutor] Stream error');
      settle(reject, err);
    });
  });
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
  logger.info({ sessionId, userId, cwd: options.cwd }, '[DockerExecutor] Starting execution');
  logger.debug({ preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[DockerExecutor] User command');

  try {
    // 步骤 1：准备容器和脚本
    const { docker, sdkScriptInfo, authToken } = await prepareContainerAndScript(userId, command, options);

    // 步骤 2：在容器中执行脚本
    const { stream } = await containerManager.execInContainer(
      userId,
      ['node', sdkScriptInfo.tmpScriptFile],
      {
        cwd: '/app',
        tty: false,
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

    // 步骤 4：处理流输出并等待结果
    return await handleStreamProcessing(stream, stdout, stderr, writer, sessionId);

  } catch (error) {
    logger.error({ sessionId, err: error }, '[DockerExecutor] Exception during execution');
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

