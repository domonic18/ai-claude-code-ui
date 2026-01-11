/**
 * 路径工具函数
 *
 * 提供路径验证、转换和构建功能。
 */

import containerManager from '../core/index.js';

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
    return { safePath: '', error: 'Absolute paths not allowed' };
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
  return hostPath.replace(/^.*:/, '/workspace');
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
  const { projectPath = '', isContainerProject = false } = options;

  // 对于容器项目，使用 /home/node/.claude/projects
  // 对于工作区文件，使用 /workspace
  let basePath = isContainerProject
    ? `/home/node/.claude/projects/${projectPath}`
    : '/workspace';

  if (!isContainerProject && projectPath) {
    basePath = hostPathToContainerPath(projectPath);
  }

  return `${basePath}/${safePath}`;
}
