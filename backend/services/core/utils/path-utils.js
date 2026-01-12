/**
 * path-utils.js
 *
 * 统一的路径处理工具
 * 合并重复的路径处理逻辑，支持容器和非容器模式
 *
 * @module core/utils/path-utils
 */

import path from 'path';
import { CONTAINER } from '../../../config/config.js';

/**
 * SDK 路径编码前缀常量
 * SDK 编码路径时使用 "workspace" 作为前缀（不包含前导斜杠）
 * 例如：/workspace/my-workspace → -workspace-my-workspace
 */
const SDK_PATH_PREFIX = 'workspace';

/**
 * 路径处理工具类
 */
export class PathUtils {
  /**
   * 解析项目路径
   * 根据容器模式和项目名称返回正确的项目路径
   *
   * @param {string} projectName - 项目名称
   * @param {Object} options - 选项
   * @param {string} [options.userId] - 用户 ID（容器模式需要）
   * @param {boolean} [options.containerMode] - 是否强制使用容器模式
   * @returns {Promise<string>} 项目路径
   */
  static async resolveProjectPath(projectName, options = {}) {
    const { containerMode } = options;
    // userId 参数在当前实现中未使用，但保留在选项中以便未来扩展
    void options.userId;

    // 检查是否为容器模式
    const isContainerMode = containerMode !== undefined
      ? containerMode
      : CONTAINER.enabled;

    if (isContainerMode) {
      // 容器模式：使用配置中的工作空间路径
      return path.join(CONTAINER.paths.workspace, projectName);
    } else {
      // 主机模式：从会话文件中提取项目路径
      const { extractProjectDirectory } = await import('../../project/index.js');
      return await extractProjectDirectory(projectName);
    }
  }

  /**
   * 同步解析项目路径（不使用异步的 extractProjectDirectory）
   *
   * @param {string} projectName - 项目名称
   * @param {Object} options - 选项
   * @param {boolean} [options.containerMode] - 是否强制使用容器模式
   * @returns {string} 项目路径
   */
  static resolveProjectPathSync(projectName, options = {}) {
    const { containerMode } = options;

    // 检查是否为容器模式
    const isContainerMode = containerMode !== undefined
      ? containerMode
      : CONTAINER.enabled;

    if (isContainerMode) {
      // 容器模式：使用配置中的工作空间路径
      return path.join(CONTAINER.paths.workspace, projectName);
    } else {
      // 主机模式：返回项目名称（需要外部调用 extractProjectDirectory）
      // 这里只提供一个回退方案
      return projectName.replace(/-/g, '/');
    }
  }

  /**
   * 编码项目名称为容器内存储格式
   * SDK 使用绝对路径编码：/workspace/my-workspace → -workspace-my-workspace
   *
   * @param {string} projectName - 项目名称（如：my-workspace）
   * @returns {string} 编码后的名称（如：-workspace-my-workspace）
   */
  static encodeProjectName(projectName) {
    // SDK 编码的是完整路径 "workspace/my-workspace"
    // 所以我们需要添加 SDK 前缀后再编码
    const fullPath = `${SDK_PATH_PREFIX}/${projectName}`;
    return fullPath.replace(/\//g, '-').replace(/^/, '-');
  }

  /**
   * 解码项目名称
   * 将编码后的项目名称还原
   *
   * @param {string} encodedName - 编码后的项目名称
   * @returns {string} 解码后的项目名称
   */
  static decodeProjectName(encodedName) {
    // 移除前缀 '-'
    const withoutPrefix = encodedName.replace(/^-/, '');
    // 替换第一个 '-' 为 '/'
    const decoded = withoutPrefix.replace(/^-/, '').replace(/-/, '/');
    // 提取项目名称部分（移除 SDK 前缀）
    const prefixWithSlash = `${SDK_PATH_PREFIX}/`;
    if (decoded.startsWith(prefixWithSlash)) {
      return decoded.substring(prefixWithSlash.length);
    }
    return decoded;
  }

  /**
   * 验证路径是否安全
   * 防止路径遍历攻击
   *
   * @param {string} requestedPath - 请求的路径
   * @param {string} rootPath - 根路径
   * @returns {boolean} 是否安全
   */
  static isPathSafe(requestedPath, rootPath) {
    const normalizedRoot = path.resolve(rootPath) + path.sep;
    const normalizedRequested = path.resolve(requestedPath);
    return normalizedRequested.startsWith(normalizedRoot);
  }

  /**
   * 安全地连接路径
   * 确保结果路径在根路径下
   *
   * @param {string} rootPath - 根路径
   * @param {...string} pathSegments - 路径片段
   * @returns {string} 安全的连接路径
   * @throws {Error} 如果路径不安全
   */
  static safeJoin(rootPath, ...pathSegments) {
    const joinedPath = path.join(rootPath, ...pathSegments);
    const normalizedRoot = path.resolve(rootPath) + path.sep;
    const normalizedJoined = path.resolve(joinedPath);

    if (!normalizedJoined.startsWith(normalizedRoot)) {
      throw new Error(`Path traversal detected: ${joinedPath}`);
    }

    return joinedPath;
  }

  /**
   * 规范化路径
   * 统一路径格式，处理相对路径等
   *
   * @param {string} inputPath - 输入路径
   * @returns {string} 规范化后的路径
   */
  static normalizePath(inputPath) {
    // 移除末尾的斜杠（除了根路径）
    let normalized = inputPath.replace(/\/+$/, '');
    if (normalized === '') normalized = '/';
    return normalized;
  }

  /**
   * 获取相对路径
   * 计算从 fromPath 到 toPath 的相对路径
   *
   * @param {string} fromPath - 起始路径
   * @param {string} toPath - 目标路径
   * @returns {string} 相对路径
   */
  static getRelativePath(fromPath, toPath) {
    return path.relative(fromPath, toPath);
  }

  /**
   * 获取文件扩展名
   *
   * @param {string} filePath - 文件路径
   * @returns {string} 文件扩展名（包含点号）
   */
  static getExtension(filePath) {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 检查文件扩展名是否允许
   *
   * @param {string} filePath - 文件路径
   * @param {Array<string>} allowedExtensions - 允许的扩展名列表
   * @returns {boolean} 是否允许
   */
  static isExtensionAllowed(filePath, allowedExtensions) {
    const ext = this.getExtension(filePath);
    return allowedExtensions.includes(ext);
  }

  /**
   * 获取项目目录中的配置文件路径
   *
   * @param {string} projectPath - 项目路径
   * @param {string} configName - 配置文件名称
   * @returns {string} 配置文件完整路径
   */
  static getProjectConfigPath(projectPath, configName) {
    // 容器模式使用配置中的 Claude 配置路径
    // 主机模式使用 ~/.claude/
    const claudeDir = CONTAINER.enabled
      ? CONTAINER.paths.claudeConfig
      : path.join(process.env.HOME || '', '.claude');

    return path.join(claudeDir, 'projects', this.encodeProjectName(projectPath), configName);
  }

  /**
   * 获取会话文件路径
   *
   * @param {string} projectPath - 项目路径
   * @param {string} sessionId - 会话 ID
   * @returns {string} 会话文件路径
   */
  static getSessionFilePath(projectPath, sessionId) {
    const encodedProjectName = this.encodeProjectName(projectPath);
    const claudeProjectsPath = CONTAINER.enabled
      ? CONTAINER.paths.projects
      : path.join(process.env.HOME || '', '.claude', 'projects');

    return path.join(claudeProjectsPath, encodedProjectName, 'sessions', `${sessionId}.jsonl`);
  }

  /**
   * 获取项目存储目录路径
   *
   * @param {string} projectPath - 项目路径
   * @returns {string} 项目存储目录路径
   */
  static getProjectStoragePath(projectPath) {
    const encodedProjectName = this.encodeProjectName(projectPath);
    const claudeProjectsPath = CONTAINER.enabled
      ? CONTAINER.paths.projects
      : path.join(process.env.HOME || '', '.claude', 'projects');

    return path.join(claudeProjectsPath, encodedProjectName);
  }

  /**
   * 检查路径是否为容器路径
   *
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否为容器路径
   */
  static isContainerPath(filePath) {
    return filePath.startsWith(CONTAINER.paths.workspace + '/');
  }

  /**
   * 将容器路径转换为显示路径
   * 用于在 UI 中显示更友好的路径
   *
   * @param {string} containerPath - 容器内路径
   * @param {string} projectName - 项目名称
   * @returns {string} 显示路径
   */
  static toDisplayPath(containerPath, projectName) {
    const workspacePrefix = CONTAINER.paths.workspace + '/';
    if (containerPath.startsWith(workspacePrefix)) {
      // 替换 /workspace/{projectName}/ 为项目根目录
      const projectPrefix = path.join(CONTAINER.paths.workspace, projectName) + '/';
      if (containerPath.startsWith(projectPrefix)) {
        return containerPath.substring(projectPrefix.length);
      }
      // 替换 /workspace/ 为根目录
      return containerPath.substring(workspacePrefix.length);
    }
    return containerPath;
  }

  /**
   * 将显示路径转换为容器路径
   *
   * @param {string} displayPath - 显示路径
   * @param {string} projectName - 项目名称
   * @returns {string} 容器路径
   */
  static toContainerPath(displayPath, projectName) {
    const workspacePrefix = CONTAINER.paths.workspace + '/';
    if (!displayPath.startsWith('/')) {
      // 相对路径，添加项目前缀
      return path.join(CONTAINER.paths.workspace, projectName, displayPath);
    } else if (displayPath.startsWith(workspacePrefix)) {
      // 已经是容器路径，直接返回
      return displayPath;
    } else {
      // 绝对路径，假设是相对于工作空间
      return path.join(CONTAINER.paths.workspace, displayPath.substring(1));
    }
  }
}

/**
 * 路径验证器
 * 用于验证路径的合法性和安全性
 */
export class PathValidator {
  /**
   * 验证项目名称
   *
   * @param {string} projectName - 项目名称
   * @returns {Object} { valid: boolean, error: string|null }
   */
  static validateProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
      return { valid: false, error: 'Project name must be a non-empty string' };
    }

    if (projectName.length > 255) {
      return { valid: false, error: 'Project name is too long (max 255 characters)' };
    }

    // 检查非法字符
    const invalidChars = /[<>:"|?*\/\\\x00-\x1F]/;
    if (invalidChars.test(projectName)) {
      return { valid: false, error: 'Project name contains invalid characters' };
    }

    // 检查保留名称
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const upperName = projectName.toUpperCase().replace(/\.(.+)$/, '');
    if (reservedNames.includes(upperName)) {
      return { valid: false, error: 'Project name is a reserved system name' };
    }

    return { valid: true, error: null };
  }

  /**
   * 验证文件路径
   *
   * @param {string} filePath - 文件路径
   * @param {string} [rootPath] - 根路径（用于安全检查）
   * @returns {Object} { valid: boolean, error: string|null }
   */
  static validateFilePath(filePath, rootPath = null) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string' };
    }

    // 检查路径遍历
    if (filePath.includes('..')) {
      return { valid: false, error: 'Path traversal detected' };
    }

    // 如果提供了根路径，进行安全检查
    if (rootPath && !PathUtils.isPathSafe(filePath, rootPath)) {
      return { valid: false, error: 'Path is outside the allowed root directory' };
    }

    return { valid: true, error: null };
  }

  /**
   * 验证会话 ID
   *
   * @param {string} sessionId - 会话 ID
   * @returns {Object} { valid: boolean, error: string|null }
   */
  static validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return { valid: false, error: 'Session ID must be a non-empty string' };
    }

    // 检查 UUID 格式（可选）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return { valid: false, error: 'Invalid session ID format (expected UUID)' };
    }

    return { valid: true, error: null };
  }
}

export default {
  PathUtils,
  PathValidator,
};
