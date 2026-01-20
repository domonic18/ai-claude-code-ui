/**
 * file-utils.js
 *
 * 文件操作通用工具函数
 * 提供跨文件适配器的通用工具方法
 *
 * @module files/utils/file-utils
 */

import { FILE_TIMEOUTS } from '../../../config/config.js';

/**
 * 文件大小常量 (字节)
 */
export const FILE_SIZE_CONSTANTS = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024
};

/**
 * 文件大小限制配置
 */
export const FILE_SIZE_LIMITS = {
  DEFAULT_MAX_SIZE: 50 * FILE_SIZE_CONSTANTS.MB, // 50MB
  SMALL_FILE_SIZE: 1 * FILE_SIZE_CONSTANTS.MB,   // 1MB
  MEDIUM_FILE_SIZE: 10 * FILE_SIZE_CONSTANTS.MB, // 10MB
  LARGE_FILE_SIZE: 100 * FILE_SIZE_CONSTANTS.MB  // 100MB
};

/**
 * 文件名有效字符正则表达式模式
 * 支持字母、数字、中文、日文、韩文、西里尔字母、希腊语、希伯来语、阿拉伯语等
 */
export const VALID_FILENAME_PATTERN = /^[\w\u4e00-\u9fa5\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f .,_+-@#()[\]{}$%'`=~!&]+$/;

/**
 * 文件名内容验证模式
 * 必须包含至少一个字母、数字或中文字符
 */
export const FILENAME_CONTENT_PATTERN = /[\w\u4e00-\u9fa5\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f]/;

/**
 * 控制字符正则表达式
 * 匹配 ASCII 控制字符 (0-31, 127)
 */
export const CONTROL_CHARS_PATTERN = /[\x00-\x1f\x7f]/g;

/**
 * Unicode 替换字符
 */
export const UNICODE_REPLACEMENT_CHAR = '\uFFFD';

/**
 * Unicode 非打印字符正则表达式
 * 匹配各种 Unicode 空格和格式控制字符
 */
export const UNICODE_NON_PRINTABLE_PATTERN = /[\u2000-\u200F\u2028-\u202F\u205F\u3000]/g;

/**
 * 默认排除的目录名称
 * 用于文件树遍历时过滤
 */
export const DEFAULT_EXCLUDED_DIRS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'target',
  'bin',
  'obj',
  '.claude'
];

/**
 * 清理文件名中的控制字符和非打印字符
 * 移除可能导致显示问题的字符
 *
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的文件名
 * @example
 * cleanFileName("test\uFFFDfile.txt") // "testfile.txt"
 * cleanFileName("file\x01\x02name.txt") // "filename.txt"
 */
export function cleanFileName(name) {
  if (!name) return '';

  let cleaned = name;

  // 移除所有控制字符和非打印字符 (ASCII 0-31, 127)
  cleaned = cleaned.replace(CONTROL_CHARS_PATTERN, '');

  // 移除 Unicode 替换字符 U+FFFD
  cleaned = cleaned.replace(new RegExp(UNICODE_REPLACEMENT_CHAR, 'g'), '');

  // 移除其他非打印 Unicode 字符
  cleaned = cleaned.replace(UNICODE_NON_PRINTABLE_PATTERN, '');

  return cleaned.trim();
}

/**
 * 验证文件名是否有效
 * 检查文件名是否符合命名规则
 *
 * @param {string} name - 文件名
 * @returns {boolean} 是否有效
 * @example
 * isValidFileName("test-file.txt") // true
 * isValidFileName("文件名.txt") // true
 * isValidFileName("") // false
 * isValidFileName("'") // false (无实质内容)
 */
export function isValidFileName(name) {
  // 检查是否为空
  if (!name || name.length === 0) return false;

  // 检查是否只包含有效字符
  if (!VALID_FILENAME_PATTERN.test(name)) return false;

  // 检查是否包含替换字符（表示原始文件已损坏）
  if (name.includes(UNICODE_REPLACEMENT_CHAR)) return false;

  // 必须包含至少一个字母、数字或中文字符（不能只有符号）
  if (!FILENAME_CONTENT_PATTERN.test(name)) return false;

  return true;
}

/**
 * 检查是否为隐藏文件或目录
 * Unix/Linux 风格的隐藏文件以点开头
 *
 * @param {string} name - 文件名
 * @returns {boolean} 是否为隐藏文件
 * @example
 * isHiddenFile(".git") // true
 * isHiddenFile(".env") // true
 * isHiddenFile("README.md") // false
 */
export function isHiddenFile(name) {
  if (!name) return false;
  return name.startsWith('.');
}

/**
 * 验证文件大小
 * 检查文件大小是否在允许范围内
 *
 * @param {string} content - 文件内容
 * @param {number} maxSize - 最大文件大小（字节）
 * @returns {{valid: boolean, error?: string}} 验证结果
 * @example
 * validateFileSize("hello world", 100) // {valid: true}
 * validateFileSize(largeContent, 1024) // {valid: false, error: "..."}
 */
export function validateFileSize(content, maxSize = FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE) {
  const size = Buffer.byteLength(content, 'utf8');

  if (size > maxSize) {
    const maxSizeMB = (maxSize / FILE_SIZE_CONSTANTS.MB).toFixed(2);
    const sizeMB = (size / FILE_SIZE_CONSTANTS.MB).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`
    };
  }

  return { valid: true };
}

/**
 * 格式化文件大小
 * 将字节数转换为人类可读格式
 *
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 * @example
 * formatFileSize(1024) // "1.00 KB"
 * formatFileSize(1048576) // "1.00 MB"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = FILE_SIZE_CONSTANTS.KB;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取文件扩展名
 * 从文件名中提取扩展名
 *
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（不含点），如果没有扩展名则返回空字符串
 * @example
 * getFileExtension("test.txt") // "txt"
 * getFileExtension("archive.tar.gz") // "gz"
 * getFileExtension("noextension") // ""
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';
}

/**
 * 判断路径是否为目录
 * 通过检查是否有其他路径以该路径开头（后面跟着斜杠）来判断
 *
 * @param {string} fullPath - 要检查的完整路径
 * @param {Set<string>} allPaths - 所有路径的集合
 * @returns {boolean} 是否为目录
 * @example
 * const paths = new Set(['/workspace/src', '/workspace/src/file.js']);
 * isDirectory('/workspace/src', paths) // true
 * isDirectory('/workspace/src/file.js', paths) // false
 */
export function isDirectory(fullPath, allPaths) {
  if (!allPaths || allPaths.size === 0) return false;

  for (const path of allPaths) {
    if (path !== fullPath && path.startsWith(fullPath + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * 标准化文件路径
 * 清理路径中的多余斜杠和 ./
 *
 * @param {string} filePath - 原始路径
 * @returns {string} 标准化后的路径
 * @example
 * normalizePath("./test//file.txt") // "test/file.txt"
 * normalizePath("/workspace/../test") // "/test"
 */
export function normalizePath(filePath) {
  if (!filePath) return '';

  return filePath
    .replace(/\/\.\//g, '/')   // 移除 /./
    .replace(/\/+/g, '/')      // 合并多个斜杠
    .replace(/\/$/, '');       // 移除尾部斜杠
}

/**
 * 构建文件树节点
 * 创建标准化的文件树节点对象
 *
 * @param {Object} options - 节点配置
 * @param {string} options.name - 文件/目录名称
 * @param {string} options.path - 完整路径
 * @param {'file'|'directory'} options.type - 类型
 * @param {Array} [options.children] - 子节点（仅目录）
 * @returns {Object} 文件树节点
 */
export function createTreeNode({ name, path, type, children = undefined }) {
  const node = {
    name,
    path,
    type
  };

  if (type === 'directory' && children !== undefined) {
    node.children = children;
  }

  return node;
}

/**
 * 包装 Promise 处理流式命令输出
 * 用于容器命令执行的通用模式
 *
 * @param {Object} stream - 命令输出流
 * @param {Object} [options] - 选项
 * @param {number} [options.timeout] - 超时时间（毫秒），默认使用配置值
 * @param {Function} [options.onError] - 自定义错误处理
 * @returns {Promise<string>} 命令输出内容
 */
export function readStreamOutput(stream, options = {}) {
  const { timeout = FILE_TIMEOUTS.default, onError } = options;

  return new Promise((resolve, reject) => {
    let output = '';
    let resolved = false;
    let timeoutId = null;

    const doResolve = (result) => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(result);
      }
    };

    const doReject = (err) => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      }
    };

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    stream.on('error', (err) => {
      if (onError) {
        onError(err, output, doResolve, doReject);
      } else {
        doReject(err);
      }
    });

    stream.on('end', () => {
      doResolve(output);
    });

    // 设置超时
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        doResolve(output);
      }, timeout);
    }
  });
}

/**
 * 标准化错误对象
 * 创建统一格式的错误对象
 *
 * @param {Error} error - 原始错误
 * @param {string} operation - 操作名称
 * @param {Object} [context] - 额外上下文信息
 * @returns {Error} 标准化的错误对象
 */
export function standardizeError(error, operation, context = {}) {
  const standardizedError = new Error(
    error.message || `${operation} failed`
  );

  standardizedError.code = error.code || 'FILE_OPERATION_ERROR';
  standardizedError.operation = operation;
  standardizedError.timestamp = new Date().toISOString();
  standardizedError.originalError = error;
  standardizedError.context = context;

  return standardizedError;
}
