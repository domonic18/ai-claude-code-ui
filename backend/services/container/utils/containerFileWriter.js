/**
 * 容器文件写入工具
 *
 * 提供通过 Docker API 将文件写入容器内的通用方法：
 * - putArchive：适用于任意大小文件，完全绕过命令行参数长度限制
 * - shell：适用于小文件，通过 base64 编码 + shell 命令写入
 *
 * @module container/utils/containerFileWriter
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import tar from 'tar';

/** mkdir 操作超时时间（毫秒） */
const MKDIR_TIMEOUT = 5000;

/**
 * shell 命令注入危险字符黑名单
 * filePath 中若包含这些字符则拒绝执行，防止命令注入
 */
const UNSAFE_PATH_CHARS = /[`$"'|&;(){}!#\\]/;

/**
 * 校验容器内文件路径是否安全（防止命令注入）
 *
 * @param {string} filePath - 容器内文件路径
 * @throws {Error} 路径包含危险字符时抛出错误
 */
function validateFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('filePath must be a non-empty string');
  }
  if (UNSAFE_PATH_CHARS.test(filePath)) {
    throw new Error(
      `filePath contains unsafe characters (possible injection): ${filePath}`
    );
  }
}

/**
 * 在容器内执行 mkdir -p（带超时保护）
 *
 * 使用数组格式 Cmd 避免命令注入风险。
 *
 * @param {object} container - Docker 容器实例
 * @param {string} targetDir - 要创建的目录路径
 * @returns {Promise<void>}
 */
async function ensureDirInContainer(container, targetDir) {
  const mkdirExec = await container.exec({
    Cmd: ['mkdir', '-p', targetDir],
    AttachStdout: true,
    AttachStderr: true
  });

  await new Promise((resolve, reject) => {
    let settled = false;
    const safeSettle = (fn, val) => {
      if (!settled) { settled = true; fn(val); }
    };

    const timer = setTimeout(() => {
      safeSettle(reject, new Error(`mkdir timed out after ${MKDIR_TIMEOUT}ms`));
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
}

/**
 * 通过 Docker putArchive API 将文件写入容器（适用于任意大小文件）
 *
 * 流程：宿主机创建临时文件 → tar 打包 → putArchive 上传 → 清理临时文件。
 * 完全绕过 exec 命令行参数长度限制（~128KB）。
 *
 * @param {object} container - Docker 容器实例
 * @param {string} containerFilePath - 容器内目标文件路径
 * @param {string} content - 要写入的文件内容
 * @param {object} [options] - 可选配置
 * @param {string} [options.logLabel='containerFileWriter'] - 日志标签
 * @returns {Promise<void>}
 */
export async function writeFileViaPutArchive(container, containerFilePath, content, options = {}) {
  const logLabel = options.logLabel || 'containerFileWriter';
  const tmpDir = path.join(process.cwd(), '.tmp', 'container_writes', randomUUID());
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // 写入本地临时文件
    const filename = path.basename(containerFilePath);
    const localFilePath = path.join(tmpDir, filename);
    await fs.writeFile(localFilePath, content, 'utf8');

    // 创建 tar 文件
    const tarPath = path.join(tmpDir, 'payload.tar');
    await tar.c({ file: tarPath, cwd: tmpDir, gzip: false }, [filename]);
    const tarBuffer = await fs.readFile(tarPath);

    // 确保目标目录存在
    const targetDir = path.dirname(containerFilePath);
    await ensureDirInContainer(container, targetDir);

    // 上传 tar 到容器目标目录
    await new Promise((resolve, reject) => {
      container.putArchive(tarBuffer, { path: targetDir }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`[${logLabel}] File written to container: ${containerFilePath} (${content.length} bytes)`);
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[${logLabel}] Failed to clean temp dir: ${tmpDir}`, e.message);
    }
  }
}

/**
 * 通过 shell 命令将内容写入容器文件（仅适用于小文件）
 *
 * 使用 base64 编码传输内容，避免特殊字符问题。
 * 受限于 exec 命令行参数长度，仅适用于 <80KB 的内容。
 * filePath 会经过安全校验，拒绝包含危险字符的路径。
 *
 * @param {object} containerManager - 容器管理器实例
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内文件路径（会进行安全校验）
 * @param {string} content - 要写入的内容
 * @returns {Promise<void>}
 */
const BASE64_REGEX = /^[A-Za-z0-9+/=\n\r]*$/;

export async function writeFileViaShell(containerManager, userId, filePath, content) {
  validateFilePath(filePath);

  const base64Content = Buffer.from(content, 'utf8').toString('base64');

  // 显式校验 base64 内容只包含合法字符，防止 shell 注入
  if (!BASE64_REGEX.test(base64Content)) {
    throw new Error('writeFileViaShell: base64 content contains unexpected characters');
  }

  const { stream } = await containerManager.execInContainer(
    userId,
    `printf '%s' "$(echo '${base64Content}' | base64 -d)" > "${filePath}"`
  );

  await new Promise((resolve, reject) => {
    let errorOutput = '';
    stream.on('data', (chunk) => {
      const output = chunk.toString();
      if (output.toLowerCase().includes('error')) {
        errorOutput += output;
      }
    });
    stream.on('error', () => reject(new Error('Failed to write file')));
    stream.on('end', () => {
      if (errorOutput) {
        reject(new Error(`Write failed: ${errorOutput}`));
      } else {
        resolve();
      }
    });
  });
}
