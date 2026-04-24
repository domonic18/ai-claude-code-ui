/**
 * 文件树遍历模块
 *
 * 提供容器内文件树遍历功能
 *
 * @module files/utils/file-tree
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { MAX_TREE_DEPTH } from '../constants.js';
import { validatePath, buildContainerPath } from './container-path-utils.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/files/utils/file-tree');

/**
 * 清理文件名中的控制字符和特殊字符
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的文件名
 */
function cleanFileName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // 移除空字节
  let cleaned = name.replace(/\0/g, '');

  // 移除控制字符（保留常见安全字符）
  // 保留：字母、数字、中文、常用符号、点、横线、下划线、空格
  cleaned = cleaned.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');

  // 移除 ANSI 转义序列
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // 移除回车和换行
  cleaned = cleaned.replace(/[\r\n]/g, '');

  // 移除前后空白
  cleaned = cleaned.trim();

  return cleaned;
}

/** 应跳过的目录名集合 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build']);

/**
 * 检查文件名是否应跳过
 * @param {string} name - 清理后的文件名
 * @returns {boolean} 是否应跳过
 */
function shouldSkipName(name) {
  return !name || name === '.' || SKIP_DIRS.has(name);
}

/**
 * 将 type 字符转为类型字符串
 * @param {string} typeChar - 'd' 或其他
 * @returns {'directory'|'file'} 类型
 */
function toFileType(typeChar) {
  return typeChar === 'd' ? 'directory' : 'file';
}

/**
 * 检查两个数值是否都有效（非 NaN）
 * @param {number} a - 第一个数值
 * @param {number} b - 第二个数值
 * @returns {boolean} 都有效时为 true
 */
function areValidNumbers(a, b) {
  return !isNaN(a) && !isNaN(b);
}

/**
 * 验证数值字段并解析为对象
 * @param {string} sizeStr - 文件大小字符串
 * @param {string} mtimeStr - 修改时间戳字符串
 * @returns {{ size: number, mtime: Date } | null} 解析后的值，或 null
 */
function parseNumericFields(sizeStr, mtimeStr) {
  const size = parseInt(sizeStr, 10);
  const mtime = parseFloat(mtimeStr);
  if (!areValidNumbers(size, mtime)) return null;

  const dateObj = new Date(mtime * 1000);
  if (isNaN(dateObj.getTime())) return null;
  return { size, mtime: dateObj };
}

/**
 * Validate a parsed line and extract parts
 * @param {string} line - Raw line
 * @returns {string[]|null} Parsed parts or null if invalid
 */
function validateTreeLine(line) {
  const parts = line.split('|');
  if (parts.length < 4) return null;
  if (shouldSkipName(cleanFileName(parts[0]))) return null;
  return parts;
}

/**
 * 解析单行文件树输出为文件项对象
 * @param {string} line - 原始行（name|type|size|mtime 格式）
 * @param {string} containerPath - 容器路径
 * @returns {Object|null} 文件项，或 null 表示跳过
 */
function parseTreeLine(line, containerPath) {
  const parts = validateTreeLine(line);
  if (!parts) return null;

  const name = cleanFileName(parts[0]);
  const fields = parseNumericFields(parts[2], parts[3]);
  if (!fields) return null;

  return {
    name,
    path: `${containerPath}/${name}`,
    type: toFileType(parts[1]),
    size: fields.size,
    modified: fields.mtime.toISOString()
  };
}

/**
 * 文件项排序：目录优先，然后按字母顺序
 * @param {Object} a - 文件项 A
 * @param {Object} b - 文件项 B
 * @returns {number} 排序比较值
 */
function compareTreeItems(a, b) {
  if (a.type !== b.type) {
    return a.type === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

/**
 * 解析文件树输出
 * @param {string} output - 原始输出
 * @param {string} containerPath - 容器路径
 * @returns {Array} 解析后的文件项数组
 */
function parseFileTreeOutput(output, containerPath) {
  const items = output
    .trim()
    .split('\n')
    .map(line => line ? parseTreeLine(line, containerPath) : null)
    .filter(Boolean);

  items.sort(compareTreeItems);
  return items;
}

/**
 * 构建 find 命令的隐藏文件标志
 * @param {boolean} showHidden - 是否显示隐藏文件
 * @returns {string} find 命令标志
 */
function buildHiddenFlag(showHidden) {
  return showHidden ? '' : '-not -path "*/.*"';
}

/**
 * 从 Docker 流中收集 stdout 输出
 * @param {Object} stream - Docker 流
 * @returns {Promise<string>} 收集到的输出
 */
function collectStreamOutput(stream) {
  return new Promise((resolve, reject) => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let output = '';

    containerManager.docker.modem.demuxStream(stream, stdout, stderr);
    stdout.on('data', (chunk) => { output += chunk.toString(); });
    stderr.on('data', (chunk) => { logger.error('[FileTree] STDERR:', chunk.toString()); });
    stream.on('error', (err) => { reject(new Error(`Failed to get file tree: ${err.message}`)); });
    stream.on('end', () => { resolve(output); });
  });
}

/** 文件树选项默认值 */
const TREE_DEFAULTS = {
  maxDepth: MAX_TREE_DEPTH,
  currentDepth: 0,
  showHidden: false,
  projectPath: '',
  isContainerProject: false
};

/**
 * 合并文件树选项与默认值
 * @param {string} dirPath - 原始目录路径
 * @param {object} options - 原始选项
 * @returns {{ safeDirPath: string, opts: Object }} 解析后的路径和选项
 */
function resolveTreeArgs(dirPath, options) {
  return {
    safeDirPath: dirPath || '.',
    opts: { ...TREE_DEFAULTS, ...(options || {}) }
  };
}

/**
 * 从容器内获取文件树
 * @param {number} userId - 用户 ID
 * @param {string} dirPath - 目录路径（相对于项目根目录）
 * @param {object} options - 选项
 * @returns {Promise<Array>} 文件树结构
 */
export async function getFileTreeInContainer(userId, dirPath, options) {
  const { safeDirPath, opts } = resolveTreeArgs(dirPath, options);

  logger.debug('[FileTree] getFileTreeInContainer - userId:', userId, 'dirPath:', safeDirPath, 'projectPath:', opts.projectPath, 'isContainerProject:', opts.isContainerProject);

  const { safePath, error } = validatePath(safeDirPath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath: opts.projectPath, isContainerProject: opts.isContainerProject });
    const hiddenFlag = buildHiddenFlag(opts.showHidden);

    const { stream } = await containerManager.execInContainer(
      userId,
      ['sh', '-c', `cd "$1" && find . -maxdepth 1 ${hiddenFlag} -printf "%P|%y|%s|%T@\\n"`, 'findTree', containerPath]
    );

    const output = await collectStreamOutput(stream);
    return parseFileTreeOutput(output, containerPath);
  } catch (err) {
    throw new Error(`Failed to get file tree in container: ${err.message}`);
  }
}
