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

  const imagePaths = [];

  try {
    // 保存图片到临时目录
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
        containerPath: `${cwd}/.tmp/images/${filename}`,
        filename
      });
    }

    if (imagePaths.length === 0) {
      return [];
    }

    // 创建包含 images 子目录的 tar 文件结构
    // tar 内容: images/image_0.png, images/image_1.png, ...
    const imagesDir = path.join(tempDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    // 移动图片到 images 子目录
    for (const img of imagePaths) {
      const newPath = path.join(imagesDir, img.filename);
      await fs.rename(img.localPath, newPath);
    }

    // 创建 tar 文件，包含 images 目录
    const tarPath = path.join(tempDir, 'images.tar');
    await tar.c({
      file: tarPath,
      cwd: tempDir,
      gzip: false
    }, ['images']);

    // 读取 tar 文件
    const tarBuffer = await fs.readFile(tarPath);

    // 确保容器内 .tmp 目录存在
    const mkdirExec = await container.exec({
      Cmd: ['mkdir', '-p', `${cwd}/.tmp`],
      AttachStdout: true,
      AttachStderr: true
    });

    await new Promise((resolve, reject) => {
      mkdirExec.start({ Detach: false }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        if (stream) {
          stream.on('close', resolve);
          stream.on('error', reject);
          // 设置超时
          setTimeout(resolve, 1000);
        } else {
          resolve();
        }
      });
    });

    // 上传 tar 文件到容器，解压到 .tmp 目录
    // tar 中的 images/ 目录会被解压到 ${cwd}/.tmp/images/
    await new Promise((resolve, reject) => {
      container.putArchive(tarBuffer, { path: `${cwd}/.tmp` }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info('[DockerExecutor] Copied', imagePaths.length, 'images to container');

    // 清理本地临时文件
    await fs.rm(tempDir, { recursive: true, force: true });

    return imagePaths.map(p => p.containerPath);

  } catch (error) {
    logger.error({ err: error }, '[DockerExecutor] Error copying images to container');
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
    throw new Error(`图片复制到容器失败: ${error.message}`);
  }
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
    // 获取容器信息
    const containerInfo = containerManager.getContainerByUserId(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }

    // 获取 Docker 容器实例
    const docker = containerManager.docker;
    const container = docker.getContainer(containerInfo.id);

    // 处理图片：复制到容器内
    let imagePaths = [];
    if (options.images && options.images.length > 0) {
      logger.info('[DockerExecutor] Copying', options.images.length, 'images to container...');
      imagePaths = await copyImagesToContainer(container, options.images, options.cwd || '/workspace/my-workspace');
      logger.info('[DockerExecutor] Image paths in container:', imagePaths);
    }

    // 构建 SDK 脚本（传递图片路径而非数据）
    const sdkScriptInfo = await buildSDKScript(command, { ...options, imagePaths }, userId);

    // 验证必需的环境变量
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (!authToken) {
      throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY must be set in environment or .env file');
    }

    // 将 options base64 数据和脚本文件写入容器
    // 使用共享的 putArchive 工具函数写入文件，完全绕过命令行长度限制
    await writeFileViaPutArchive(container, sdkScriptInfo.tmpOptionsFile, sdkScriptInfo.optionsBase64, { logLabel: 'DockerExecutor' });
    await writeFileViaPutArchive(container, sdkScriptInfo.tmpScriptFile, sdkScriptInfo.scriptContent, { logLabel: 'DockerExecutor' });

    // 在容器中执行脚本文件（使用数组格式 Cmd，不经过 shell 解释，无注入风险）
    const { stream, exec } = await containerManager.execInContainer(
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
          // 不传递 ANTHROPIC_MODEL 环境变量，让 SDK 使用前端传入的 model 参数
        }
      }
    );

    // 保存 stream 对象到会话，以便后续可以终止进程
    setSessionStream(sessionId, stream);

    logger.info('[DockerExecutor] Execution started, stream:', !!stream, 'exec:', !!exec);

    // 收集输出
    const stdoutChunks = [];
    const stderrChunks = [];
    let dataCount = 0;

    // Docker exec stream 是多路复用的，需要分离 stdout 和 stderr
    const { PassThrough } = await import('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // 使用 Docker 的 modem.demuxStream 来分离
    docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve, reject) => {
      // 添加超时保护（可配置，0 表示禁用）
      const timeoutMs = SDK.executionTimeout;
      let timeoutHandle = null;
      let settled = false;  // 标志：Promise 是否已经 settle

      const settle = (fn, value) => {
        if (!settled) {
          settled = true;
          fn(value);
        }
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

      // 用于追踪会话创建
      const state = { sessionCreatedSent: false };
      
      // 监听 stdout（SDK 输出）
      stdout.on('data', (chunk) => {
        dataCount++;
        const output = chunk.toString();
        stdoutChunks.push(output);

        // 通过 writer 发送到 WebSocket
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

        // 区分真正的错误和 SDK 调试输出
        if (hasRealError(stderrText)) {
          // 真正的错误：ERROR 级别，记录完整内容
          logger.error({ sessionId, stderr: stderrText.substring(0, 2000) }, '[DockerExecutor] STDERR error detected');
        } else if (stderrText.startsWith('[SDK]') || stderrText.includes('Error') || stderrText.includes('Exception')) {
          // SDK 调试输出或非致命警告：DEBUG 级别
          logger.debug({ sessionId, stderr: stderrText.substring(0, 500) }, '[DockerExecutor] STDERR debug output');
        }
      });

      // 监听流结束
      stream.on('end', () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // 检查会话是否被中止
        const session = getSession(sessionId);
        if (!session && dataCount > 0) {
          // 如果会话在 Map 中找不到，且已经有数据产生，可能是被 abortSession 删除了
          logger.info(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
          settle(resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
          return;
        }

        const stdoutOutput = stdoutChunks.join('');
        const stderrOutput = stderrChunks.join('');

        logger.info({ sessionId, totalChunks: dataCount, stdoutLength: stdoutOutput.length, stderrLength: stderrOutput.length }, '[DockerExecutor] Stream ended');

        // 检查是否有真正的错误
        if (hasRealError(stderrOutput)) {
          logger.error({ sessionId, stderr: stderrOutput.substring(0, 2000) }, '[DockerExecutor] Execution failed');
          settle(reject, new Error(`SDK execution error: ${stderrOutput}`));
        } else {
          logger.info({ sessionId }, '[DockerExecutor] Execution completed successfully');
          settle(resolve, { output: stdoutOutput, sessionId });
        }
      });

      stream.on('error', (err) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        logger.error({ sessionId, err }, '[DockerExecutor] Stream error');
        settle(reject, err);
      });
    });

  } catch (error) {
    logger.error({ sessionId, err: error }, '[DockerExecutor] Exception during execution');
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

