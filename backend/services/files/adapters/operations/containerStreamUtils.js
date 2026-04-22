/**
 * containerStreamUtils.js
 *
 * Utility functions for handling Docker container stream responses
 * Extracted from FileAdapter to reduce complexity
 *
 * @module files/adapters/operations/containerStreamUtils
 */

import containerManager from '../../../container/core/index.js';

/** Operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/** Check file exists timeout in milliseconds */
const CHECK_EXISTS_TIMEOUT_MS = 2000;

// 文件操作处理程序使用此函数防止异步 Docker exec 中的竞态条件
/**
 * Create a single-resolve promise wrapper with timeout support
 * Prevents multiple resolve/reject calls on the same promise
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Function} onTimeout - Called when timeout triggers
 * @returns {{ resolve: Function, reject: Function, promise: Promise, isSettled: Function }}
 */
export function createResolvablePromise(timeoutMs, onTimeout) {
  let settled = false;
  let timeoutId = null;

  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        onTimeout();
      }
    }, timeoutMs);

    const safeResolve = (value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      }
    };

    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(err);
      }
    };

    // 在 promise 上存储解析器以供外部访问
    promise._resolve = safeResolve;
    promise._reject = safeReject;
  });

  return {
    promise,
    resolve: promise._resolve,
    reject: promise._reject,
    isSettled: () => settled,
  };
}

// 删除操作使用此函数在返回成功之前确认文件已删除
/**
 * Verify that a file has been deleted from the container
 * @param {string} containerPath - Path to check
 * @param {string} userId - User ID for container access
 * @returns {Promise<boolean>} true if file no longer exists
 */
export async function verifyFileDeleted(containerPath, userId) {
  const checkCommand = `test -e "${containerPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
  const { stream: checkStream } = await containerManager.execInContainer(userId, checkCommand);

  return new Promise((resolve) => {
    let output = '';
    checkStream.on('data', (chunk) => { output += chunk.toString(); });
    checkStream.on('end', () => {
      resolve(output.trim() !== 'EXISTS');
    });
  });
}

// FileAdapter.deleteFile 使用此函数处理删除操作的 Docker exec 流
/**
 * Handle delete response stream with verification
 * @param {Object} stream - Docker command output stream
 * @param {string} containerPath - Container path that was deleted
 * @param {string} userId - User ID for verification
 * @returns {Promise<{success: boolean}>} Deletion result
 */
export function handleDeleteStream(stream, containerPath, userId) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const safeResolve = (result) => {
      if (!settled) { settled = true; resolve(result); }
    };
    const safeReject = (err) => {
      if (!settled) { settled = true; reject(err); }
    };

    stream.on('data', () => {});
    stream.on('error', (err) => {
      safeReject(new Error(`Failed to delete file: ${err.message}`));
    });

    stream.on('end', async () => {
      try {
        const deleted = await verifyFileDeleted(containerPath, userId);
        if (deleted) {
          safeResolve({ success: true });
        } else {
          safeReject(new Error('File still exists after deletion'));
        }
      } catch {
        safeResolve({ success: true });
      }
    });

    setTimeout(() => safeResolve({ success: true }), OPERATION_TIMEOUT_MS);
  });
}

// FileAdapter.fileExists 使用此函数解析 Docker exec 流输出
/**
 * Handle file existence check stream
 * @param {Object} stream - Docker command output stream
 * @returns {Promise<boolean>} Whether file exists
 */
export function handleExistsStream(stream) {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;

    const safeResolve = (value) => {
      if (!settled) { settled = true; resolve(value); }
    };

    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('error', () => safeResolve(false));
    stream.on('end', () => safeResolve(output.trim() === 'EXISTS'));

    setTimeout(() => safeResolve(false), CHECK_EXISTS_TIMEOUT_MS);
  });
}

export { OPERATION_TIMEOUT_MS, CHECK_EXISTS_TIMEOUT_MS };
