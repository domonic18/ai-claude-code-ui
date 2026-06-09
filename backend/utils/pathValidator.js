/**
 * pathValidator.js
 *
 * 容器内路径安全校验工具
 * 防止路径遍历攻击（如 /workspace/../etc/passwd）和 shell 注入。
 *
 * 使用 path.posix.normalize 消除 .. 和 . 段后校验前缀，
 * 比 startsWith('/workspace/') 更严格——后者无法拦截
 * /workspace/../../etc/passwd 等变体。
 *
 * @module utils/pathValidator
 */

import path from 'path';

/** 容器内工作区根路径 */
const WORKSPACE_ROOT = '/workspace/';

/** 项目名称中的非法字符（文件系统不安全 + shell 特殊字符） */
const INVALID_PROJECT_NAME_CHARS = /[<>:"|?*\/\\\x00-\x1F;&`$!#(){}[\]~]/;

/**
 * 验证项目名称是否安全
 *
 * 拒绝包含文件系统特殊字符和 shell 元字符的项目名称，
 * 使 projectName 可安全拼入 sh -c 命令字符串。
 *
 * @param {string} projectName - 项目名称
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateProjectName(projectName) {
  if (!projectName || typeof projectName !== 'string') {
    return { valid: false, error: 'Project name is required' };
  }

  if (projectName.length > 255) {
    return { valid: false, error: 'Project name is too long (max 255 characters)' };
  }

  if (INVALID_PROJECT_NAME_CHARS.test(projectName)) {
    return { valid: false, error: 'Project name contains invalid characters' };
  }

  return { valid: true, error: null };
}

/**
 * 验证文件路径是否安全地限定在容器 /workspace/ 目录内
 *
 * 通过 normalize 消除 .. 和 . 段后再校验前缀，
 * 阻止 /workspace/../etc/passwd 类路径遍历。
 *
 * @param {string} filePath - 待校验的文件路径
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateContainerPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'File path is required' };
  }

  // 拒绝空字节注入
  if (filePath.includes('\0')) {
    return { valid: false, error: 'Invalid characters in file path' };
  }

  // 标准化路径（消除 .. 和 . 段），然后检查是否仍在 /workspace/ 下
  const normalized = path.posix.normalize(filePath);

  if (!normalized.startsWith(WORKSPACE_ROOT)) {
    return { valid: false, error: 'Invalid file path: must be within /workspace/' };
  }

  // 标准化后路径深度至少为 3 段（/workspace/project/file）
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 3) {
    return { valid: false, error: 'Invalid file path: insufficient depth' };
  }

  return { valid: true, error: null };
}

/**
 * 验证文件路径是否限定在指定项目的目录内
 *
 * @param {string} filePath - 待校验的文件路径
 * @param {string} projectName - 项目名称
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateProjectFilePath(filePath, projectName) {
  const pathCheck = validateContainerPath(filePath);
  if (!pathCheck.valid) return pathCheck;

  const normalized = path.posix.normalize(filePath);
  const projectPrefix = path.posix.normalize(`/workspace/${projectName}/`);

  if (!normalized.startsWith(projectPrefix)) {
    return { valid: false, error: 'Invalid file path: outside project directory' };
  }

  return { valid: true, error: null };
}
