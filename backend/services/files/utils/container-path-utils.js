/**
 * 容器路径工具函数
 *
 * 提供容器内路径验证、转换和构建功能
 *
 * @module files/utils/container-path-utils
 */

import containerManager from '../../container/core/index.js';
import { CONTAINER } from '../../../config/config.js';

/**
 * 在容器内执行命令并等待完成
 * @param {number} userId - 用户 ID
 * @param {string} command - 要执行的命令
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execCommand(userId, command) {
  const { stream } = await containerManager.execInContainer(userId, command);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    stream.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    stream.on('error', (err) => {
      stderr += err.toString();
    });

    stream.on('end', () => {
      // 移除 ANSI 转义序列和控制字符
      const cleanedStdout = stdout
        .replace(/\x1b\[[0-9;]*m/g, '')           // 移除颜色代码
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')    // 移除其他转义序列
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '') // 移除控制字符
        .replace(/[\r\n]+/g, '\n')                // 规范化换行符
        .trim();

      resolve({ stdout: cleanedStdout, stderr, exitCode: 0 });
    });
  });
}

/**
 * 验证和清理容器操作的文件路径
 * @param {string} filePath - 要验证的文件路径
 * @returns {{safePath: string, error: string|null}}
 */
export function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { safePath: '', error: 'Invalid file path' };
  }

  // 移除所有空字节
  const cleanPath = filePath.replace(/\0/g, '');

  // 检查路径遍历尝试
  if (cleanPath.includes('..')) {
    return { safePath: '', error: 'Path traversal detected' };
  }

  // 检查绝对路径
  if (cleanPath.startsWith('/')) {
    // 允许容器内的合法绝对路径前缀
    const allowedPrefixes = [
      CONTAINER.paths.projects,
      CONTAINER.paths.workspace
    ];

    const isAllowed = allowedPrefixes.some(prefix => cleanPath.startsWith(prefix));

    if (!isAllowed) {
      return { safePath: '', error: 'Absolute paths not allowed' };
    }
  }

  // 检查 shell 命令注入
  const dangerousChars = [';', '&', '|', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (cleanPath.includes(char)) {
      return { safePath: '', error: 'Path contains dangerous characters' };
    }
  }

  return { safePath: cleanPath, error: null };
}

/**
 * 将主机路径转换为容器路径
 * @param {string} hostPath - 主机系统上的路径
 * @returns {string} 容器内的路径
 */
export function hostPathToContainerPath(hostPath) {
  return hostPath.replace(/^.*:/, CONTAINER.paths.workspace);
}

/**
 * 构建容器内路径
 * @param {string} safePath - 验证后的安全路径
 * @param {object} options - 路径选项
 * @param {string} options.projectPath - 项目路径
 * @param {boolean} options.isContainerProject - 是否为容器项目
 * @returns {string} 容器内完整路径
 */
export function buildContainerPath(safePath, options = {}) {
  // 如果 safePath 已经是容器内的绝对路径，直接返回
  if (safePath.startsWith(CONTAINER.paths.projects) || safePath.startsWith(CONTAINER.paths.workspace)) {
    console.log('[PathUtils] Path is already absolute container path:', safePath);
    return safePath;
  }

  const { projectPath = '', isContainerProject = false } = options;

  console.log('[PathUtils] buildContainerPath - safePath:', safePath, 'projectPath:', projectPath, 'isContainerProject:', isContainerProject);

  // 验证 projectPath：如果是绝对路径（以 / 开头），这是错误的用法
  let normalizedProjectPath = projectPath;
  if (projectPath && projectPath.startsWith('/')) {
    console.error('[PathUtils] ERROR: projectPath should not be an absolute path:', projectPath);
    // 移除前导斜杠，只保留相对部分
    normalizedProjectPath = projectPath.substring(1);
    console.log('[PathUtils] Normalized projectPath to:', normalizedProjectPath);
  }

  // 处理当前目录 '.' 的情况，移除它以避免路径中出现 /./
  const processedSafePath = (safePath === '.' || safePath === './') ? '' : safePath;

  // 使用配置中的路径规范
  // 注意：容器项目代码直接在 /workspace 下，不在 .claude/projects 下
  // .claude/projects 是 SDK 自动管理会话文件的元数据目录
  let basePath = isContainerProject
    ? `${CONTAINER.paths.workspace}/${normalizedProjectPath}`
    : CONTAINER.paths.workspace;

  if (!isContainerProject && normalizedProjectPath) {
    basePath = hostPathToContainerPath(normalizedProjectPath);
  }

  // 构建最终路径，如果 processedSafePath 为空则不添加 /
  const result = processedSafePath
    ? `${basePath}/${processedSafePath}`.replace(/\/+/g, '/')
    : basePath.replace(/\/+/g, '/');

  console.log('[PathUtils] Final container path:', result);

  return result;
}
