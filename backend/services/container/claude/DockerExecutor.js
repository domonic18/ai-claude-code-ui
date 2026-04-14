/**
 * Docker 执行引擎
 *
 * 负责在 Docker 容器内执行脚本并处理流式输出。
 */

import containerManager from '../core/index.js';
import { buildSDKScript } from './ScriptBuilder.js';
import { processOutput } from './MessageTransformer.js';
import { setSessionStream, getSession } from './SessionManager.js';
import { SDK } from '../../../config/config.js';
import { promises as fs } from 'fs';
import path from 'path';
import tar from 'tar';

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
        console.error('[DockerExecutor] Invalid image data format for image', i);
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

    console.log('[DockerExecutor] Copied', imagePaths.length, 'images to container');

    // 清理本地临时文件
    await fs.rm(tempDir, { recursive: true, force: true });

    return imagePaths.map(p => p.containerPath);

  } catch (error) {
    console.error('[DockerExecutor] Error copying images to container:', error);
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
    return [];
  }
}

/**
 * 将文件内容写入容器内的指定路径
 * 使用 Docker putArchive API 传输文件，完全绕过命令行参数长度限制
 *
 * @param {object} container - Docker 容器实例
 * @param {string} containerFilePath - 容器内的目标文件路径（如 /tmp/sdk_opts_xxx.b64）
 * @param {string} content - 要写入的文件内容
 * @returns {Promise<void>}
 */
async function writeFileToContainer(container, containerFilePath, content) {
  // 使用 crypto.randomUUID() 保证唯一性，避免并发冲突
  const { randomUUID } = await import('crypto');
  const tmpDir = path.join(process.cwd(), '.tmp', 'sdk_files', randomUUID());
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // 写入本地临时文件
    const filename = path.basename(containerFilePath);
    const localFilePath = path.join(tmpDir, filename);
    await fs.writeFile(localFilePath, content);

    // 创建 tar 文件
    const tarPath = path.join(tmpDir, 'payload.tar');
    await tar.c({
      file: tarPath,
      cwd: tmpDir,
      gzip: false
    }, [filename]);

    // 读取 tar 文件
    const tarBuffer = await fs.readFile(tarPath);

    // 确保目标目录存在（使用数组格式的 Cmd 避免命令注入风险）
    const targetDir = path.dirname(containerFilePath);
    const mkdirExec = await container.exec({
      Cmd: ['mkdir', '-p', targetDir],
      AttachStdout: true,
      AttachStderr: true
    });

    // 等待 mkdir 完成（带超时保护，防止 Docker daemon 无响应时永久阻塞）
    const MKDIR_TIMEOUT = 5000;
    await new Promise((resolve, reject) => {
      let settled = false;
      const safeSettle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

      const timer = setTimeout(() => {
        safeSettle(reject, new Error(`mkdir exec timed out after ${MKDIR_TIMEOUT}ms`));
      }, MKDIR_TIMEOUT);

      mkdirExec.start({ Detach: false }, (err, stream) => {
        if (err) { clearTimeout(timer); safeSettle(reject, err); return; }
        if (!stream) { clearTimeout(timer); safeSettle(resolve); return; }

        // 必须消费流数据，否则在某些 Docker/Node 环境下 close/end 事件不触发
        stream.resume();
        stream.on('end', () => { clearTimeout(timer); safeSettle(resolve); });
        stream.on('close', () => { clearTimeout(timer); safeSettle(resolve); });
        stream.on('error', (e) => { clearTimeout(timer); safeSettle(reject, e); });
      });
    });

    // 上传 tar 到容器
    await new Promise((resolve, reject) => {
      container.putArchive(tarBuffer, { path: targetDir }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`[DockerExecutor] File written to container: (${content.length} bytes)`);

  } finally {
    // 清理本地临时文件
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
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
  console.log('[DockerExecutor] Starting execution');
  console.log('[DockerExecutor] userId:', userId);
  console.log('[DockerExecutor] command:', command);
  console.log('[DockerExecutor] cwd:', options.cwd);

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
      console.log('[DockerExecutor] Copying', options.images.length, 'images to container...');
      imagePaths = await copyImagesToContainer(container, options.images, options.cwd || '/workspace/my-workspace');
      console.log('[DockerExecutor] Image paths in container:', imagePaths);
    }

    // 构建 SDK 脚本（传递图片路径而非数据）
    const sdkScriptInfo = await buildSDKScript(command, { ...options, imagePaths }, userId);

    // 验证必需的环境变量
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (!authToken) {
      throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY must be set in environment or .env file');
    }

    // 将 options base64 数据和脚本文件写入容器
    // 使用 Docker putArchive API 写入文件，完全绕过命令行长度限制
    // 当 agents prompt 较大时，optionsJson 可能超过 95KB，命令行无法承载
    await writeFileToContainer(container, sdkScriptInfo.tmpOptionsFile, sdkScriptInfo.optionsBase64);
    await writeFileToContainer(container, sdkScriptInfo.tmpScriptFile, sdkScriptInfo.scriptContent);
    console.log('[DockerExecutor] Script files written to container:', sdkScriptInfo.tmpScriptFile);

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

    console.log('[DockerExecutor] Execution started, stream:', !!stream, 'exec:', !!exec);

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
        console.log(`[DockerExecutor] Setting execution timeout: ${timeoutMinutes} minutes`);
        timeoutHandle = setTimeout(() => {
          console.error(`[DockerExecutor] Execution timeout after ${timeoutMinutes} minutes`);
          stdout.destroy();
          stderr.destroy();
          stream.destroy();
          settle(reject, new Error(`SDK execution timeout (${timeoutMinutes} minutes)`));
        }, timeoutMs);
      } else {
        console.log('[DockerExecutor] Execution timeout disabled (SDK_EXECUTION_TIMEOUT=0)');
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
            console.error('[DockerExecutor] Error processing output:', e);
          }
        } else {
          console.warn('[DockerExecutor] Writer not available');
        }
      });

      // 监听 stderr（错误和调试信息）
      stderr.on('data', (chunk) => {
        const errorMsg = chunk.toString();
        // 只输出可打印的调试日志，避免输出二进制数据污染日志
        if (errorMsg.startsWith('[SDK]') || errorMsg.includes('Error') || errorMsg.includes('Exception')) {
          console.error('[DockerExecutor] STDERR:', errorMsg.substring(0, 500));
        }
        stderrChunks.push(errorMsg);
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
          console.log(`[DockerExecutor] Stream ended for session ${sessionId}, session seems to have been aborted`);
          settle(resolve, { output: stdoutChunks.join(''), sessionId, aborted: true });
          return;
        }

        const stdoutOutput = stdoutChunks.join('');
        const stderrOutput = stderrChunks.join('');

        console.log('[DockerExecutor] Stream ended. Total chunks:', dataCount);
        console.log('[DockerExecutor] STDOUT length:', stdoutOutput.length);
        console.log('[DockerExecutor] STDERR length:', stderrOutput.length);

        // 检查是否有真正的错误
        if (hasRealError(stderrOutput)) {
          console.error('[DockerExecutor] Execution failed:', stderrOutput);
          settle(reject, new Error(`SDK execution error: ${stderrOutput}`));
        } else {
          console.log('[DockerExecutor] Execution completed successfully');
          settle(resolve, { output: stdoutOutput, sessionId });
        }
      });

      stream.on('error', (err) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        console.error('[DockerExecutor] Stream error:', err);
        settle(reject, err);
      });
    });

  } catch (error) {
    console.error('[DockerExecutor] Exception:', error);
    throw new Error(`在容器中执行 SDK 失败：${error.message}`);
  }
}

