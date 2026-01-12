/**
 * GitHub 集成服务
 *
 * 处理 GitHub 仓库克隆和相关操作。
 *
 * @module services/workspace/github-service
 */

import { spawn } from 'child_process';

/**
 * GitHub 令牌信息
 * @typedef {Object} GithubToken
 * @property {number} id - 令牌 ID
 * @property {string} github_token - GitHub 访问令牌
 */

/**
 * 克隆仓库结果
 * @typedef {Object} CloneResult
 * @property {string} stdout - 标准输出
 * @property {string} stderr - 标准错误输出
 */

/**
 * 从数据库获取 GitHub 令牌
 *
 * @param {number} tokenId - 令牌 ID
 * @param {number} userId - 用户 ID
 * @returns {Promise<GithubToken|null>}
 */
export async function getGithubTokenById(tokenId, userId) {
  const { getDatabase } = await import('../database/db.js');
  const db = await getDatabase();

  const credential = await db.get(
    'SELECT * FROM user_credentials WHERE id = ? AND user_id = ? AND credential_type = ? AND is_active = 1',
    [tokenId, userId, 'github_token']
  );

  if (credential) {
    return {
      ...credential,
      github_token: credential.credential_value
    };
  }

  return null;
}

/**
 * 克隆 GitHub 仓库
 *
 * @param {string} githubUrl - GitHub 仓库 URL
 * @param {string} destinationPath - 目标路径
 * @param {string|null} githubToken - GitHub 访问令牌（可选）
 * @returns {Promise<CloneResult>}
 * @throws {Error} 如果克隆失败
 */
export function cloneGitHubRepository(githubUrl, destinationPath, githubToken = null) {
  return new Promise((resolve, reject) => {
    // 解析 GitHub URL 并在提供时注入令牌
    let cloneUrl = githubUrl;

    if (githubToken) {
      try {
        const url = new URL(githubUrl);
        // 格式：https://TOKEN@github.com/user/repo.git
        url.username = githubToken;
        url.password = '';
        cloneUrl = url.toString();
      } catch (error) {
        return reject(new Error('Invalid GitHub URL format'));
      }
    }

    const gitProcess = spawn('git', ['clone', cloneUrl, destinationPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0' // 禁用 git 密码提示
      }
    });

    let stdout = '';
    let stderr = '';

    gitProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const errorMessage = parseGitError(stderr);
        reject(new Error(errorMessage));
      }
    });

    gitProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('Git is not installed or not in PATH'));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * 解析 Git 错误消息以提供有用的反馈
 *
 * @param {string} stderr - Git 标准错误输出
 * @returns {string} 格式化的错误消息
 */
function parseGitError(stderr) {
  if (stderr.includes('Authentication failed') || stderr.includes('could not read Username')) {
    return 'Authentication failed. Please check your GitHub token.';
  }
  if (stderr.includes('Repository not found')) {
    return 'Repository not found. Please check the URL and ensure you have access.';
  }
  if (stderr.includes('already exists')) {
    return 'Directory already exists';
  }
  if (stderr) {
    return stderr;
  }
  return 'Git clone failed';
}

/**
 * 验证 GitHub URL 格式
 *
 * @param {string} url - GitHub URL
 * @returns {boolean} URL 是否有效
 */
export function isValidGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com';
  } catch {
    return false;
  }
}
