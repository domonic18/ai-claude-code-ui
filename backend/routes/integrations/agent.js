import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { repositories } from '../../database/db.js';
import { addProjectManually } from '../../services/projects/index.js';
import { queryClaudeSDK } from '../../services/execution/claude/index.js';
import { spawnCursor } from '../../services/execution/cursor/index.js';
import { queryCodex } from '../../services/execution/codex/index.js';
import { Octokit } from '@octokit/rest';
import { CLAUDE_MODELS, CURSOR_MODELS, CODEX_MODELS } from '../../../shared/modelConstants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/integrations/agent');
const { User, ApiKey, GitHubToken } = repositories;

const router = express.Router();

/**
 * 用于验证代理 API 请求的中间件。
 *
 * 支持两种身份验证模式：
 * 1. 平台模式（VITE_IS_PLATFORM=true）：用于托管/托管部署，其中
 *    身份验证由外部代理处理。请求受信任并使用默认用户上下文。
 *
 * 2. API 密钥模式（默认）：用于自托管部署，用户通过
 *    在 UI 中创建的 API 密钥进行身份验证。密钥根据本地数据库进行验证。
 */
const validateExternalApiKey = (req, res, next) => {
  // 平台模式：身份验证由外部处理（例如，由代理层）。
  // 信任请求并使用默认用户上下文。
  if (process.env.VITE_IS_PLATFORM === 'true') {
    try {
      const user = User.getFirst();
      if (!user) {
        return res.status(500).json({ error: 'Platform mode: No user found in database' });
      }
      req.user = user;
      return next();
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Platform mode error');
      return res.status(500).json({ error: 'Platform mode: Failed to fetch user' });
    }
  }

  // 自托管模式：验证来自标头或查询参数的 API 密钥
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const user = ApiKey.validate(apiKey);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  req.user = user;
  next();
};

/**
 * 获取 git 仓库的远程 URL
 * @param {string} repoPath - git 仓库的路径
 * @returns {Promise<string>} - 仓库的远程 URL
 */
async function getGitRemoteUrl(repoPath) {
  return new Promise((resolve, reject) => {
    const gitProcess = spawn('git', ['config', '--get', 'remote.origin.url'], {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe']
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
        resolve(stdout.trim());
      } else {
        reject(new Error(`Failed to get git remote: ${stderr}`));
      }
    });

    gitProcess.on('error', (error) => {
      reject(new Error(`Failed to execute git: ${error.message}`));
    });
  });
}

/**
 * 规范化 GitHub URL 以进行比较
 * @param {string} url - GitHub URL
 * @returns {string} - 规范化的 URL
 */
function normalizeGitHubUrl(url) {
  // Remove .git suffix
  let normalized = url.replace(/\.git$/, '');
  // Convert SSH to HTTPS format for comparison
  normalized = normalized.replace(/^git@github\.com:/, 'https://github.com/');
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  return normalized.toLowerCase();
}

/**
 * 解析 GitHub URL 以提取所有者和仓库
 * @param {string} url - GitHub URL（HTTPS 或 SSH）
 * @returns {{owner: string, repo: string}} - 解析的所有者和仓库
 */
function parseGitHubUrl(url) {
  // Handle HTTPS URLs: https://github.com/owner/repo or https://github.com/owner/repo.git
  // Handle SSH URLs: git@github.com:owner/repo or git@github.com:owner/repo.git
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  };
}

/**
 * 从消息自动生成分支名称
 * @param {string} message - 代理消息
 * @returns {string} - 生成的分支名称
 */
function autogenerateBranchName(message) {
  // Convert to lowercase, replace spaces/special chars with hyphens
  let branchName = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Ensure non-empty fallback
  if (!branchName) {
    branchName = 'task';
  }

  // Generate timestamp suffix (last 6 chars of base36 timestamp)
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = `-${timestamp}`;

  // Limit length to ensure total length including suffix fits within 50 characters
  const maxBaseLength = 50 - suffix.length;
  if (branchName.length > maxBaseLength) {
    branchName = branchName.substring(0, maxBaseLength);
  }

  // Remove any trailing hyphen after truncation and ensure no leading hyphen
  branchName = branchName.replace(/-$/, '').replace(/^-+/, '');

  // If still empty or starts with hyphen after cleanup, use fallback
  if (!branchName || branchName.startsWith('-')) {
    branchName = 'task';
  }

  // Combine base name with timestamp suffix
  branchName = `${branchName}${suffix}`;

  // Final validation: ensure it matches safe pattern
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchName)) {
    // Fallback to deterministic safe name
    return `branch-${timestamp}`;
  }

  return branchName;
}

/**
 * 验证 Git 分支名称
 * @param {string} branchName - 要验证的分支名称
 * @returns {{valid: boolean, error?: string}} - 验证结果
 */
function validateBranchName(branchName) {
  if (!branchName || branchName.trim() === '') {
    return { valid: false, error: 'Branch name cannot be empty' };
  }

  // Git branch name rules
  const invalidPatterns = [
    { pattern: /^\./, message: 'Branch name cannot start with a dot' },
    { pattern: /\.$/, message: 'Branch name cannot end with a dot' },
    { pattern: /\.\./, message: 'Branch name cannot contain consecutive dots (..)' },
    { pattern: /\s/, message: 'Branch name cannot contain spaces' },
    { pattern: /[~^:?*\[\\]/, message: 'Branch name cannot contain special characters: ~ ^ : ? * [ \\' },
    { pattern: /@{/, message: 'Branch name cannot contain @{' },
    { pattern: /\/$/, message: 'Branch name cannot end with a slash' },
    { pattern: /^\//, message: 'Branch name cannot start with a slash' },
    { pattern: /\/\//, message: 'Branch name cannot contain consecutive slashes' },
    { pattern: /\.lock$/, message: 'Branch name cannot end with .lock' }
  ];

  for (const { pattern, message } of invalidPatterns) {
    if (pattern.test(branchName)) {
      return { valid: false, error: message };
    }
  }

  // Check for ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(branchName)) {
    return { valid: false, error: 'Branch name cannot contain control characters' };
  }

  return { valid: true };
}

/**
 * 从仓库获取最近的提交消息
 * @param {string} projectPath - git 仓库的路径
 * @param {number} limit - 要检索的提交数量（默认：5）
 * @returns {Promise<string[]>} - 提交消息数组
 */
async function getCommitMessages(projectPath, limit = 5) {
  return new Promise((resolve, reject) => {
    const gitProcess = spawn('git', ['log', `-${limit}`, '--pretty=format:%s'], {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
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
        const messages = stdout.trim().split('\n').filter(msg => msg.length > 0);
        resolve(messages);
      } else {
        reject(new Error(`Failed to get commit messages: ${stderr}`));
      }
    });

    gitProcess.on('error', (error) => {
      reject(new Error(`Failed to execute git: ${error.message}`));
    });
  });
}

/**
 * 使用 API 在 GitHub 上创建新分支
 * @param {Octokit} octokit - Octokit 实例
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} branchName - 新分支的名称
 * @param {string} baseBranch - 要分支的基础分支（默认：'main'）
 * @returns {Promise<void>}
 */
async function createGitHubBranch(octokit, owner, repo, branchName, baseBranch = 'main') {
  try {
    // Get the SHA of the base branch
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    });

    const baseSha = ref.object.sha;

    // Create the new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    logger.info({ branchName, owner, repo }, `Created branch '${branchName}' on GitHub`);
  } catch (error) {
    if (error.status === 422 && error.message.includes('Reference already exists')) {
      logger.info({ branchName, owner, repo }, `Branch '${branchName}' already exists on GitHub`);
    } else {
      throw error;
    }
  }
}

/**
 * 在 GitHub 上创建拉取请求
 * @param {Octokit} octokit - Octokit 实例
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} branchName - 头部分支名称
 * @param {string} title - PR 标题
 * @param {string} body - PR 正文/描述
 * @param {string} baseBranch - 基础分支（默认：'main'）
 * @returns {Promise<{number: number, url: string}>} - PR 编号和 URL
 */
async function createGitHubPR(octokit, owner, repo, branchName, title, body, baseBranch = 'main') {
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title,
    head: branchName,
    base: baseBranch,
    body
  });

  logger.info({ prNumber: pr.number, url: pr.html_url, owner, repo, branchName, title, body, baseBranch },
    `Created pull request #${pr.number}: ${pr.html_url}`);

  return {
    number: pr.number,
    url: pr.html_url
  };
}

/**
 * 将 GitHub 仓库克隆到目录
 * @param {string} githubUrl - GitHub 仓库 URL
 * @param {string} githubToken - 可选的 GitHub 令牌，用于私有仓库
 * @param {string} projectPath - 克隆仓库的路径
 * @returns {Promise<string>} - 克隆仓库的路径
 */
async function cloneGitHubRepo(githubUrl, githubToken = null, projectPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate GitHub URL
      if (!githubUrl || !githubUrl.includes('github.com')) {
        throw new Error('Invalid GitHub URL');
      }

      const cloneDir = path.resolve(projectPath);

      // Check if directory already exists
      try {
        await fs.access(cloneDir);
        // Directory exists - check if it's a git repo with the same URL
        try {
          const existingUrl = await getGitRemoteUrl(cloneDir);
          const normalizedExisting = normalizeGitHubUrl(existingUrl);
          const normalizedRequested = normalizeGitHubUrl(githubUrl);

          if (normalizedExisting === normalizedRequested) {
            logger.info({ cloneDir, githubUrl }, 'Repository already exists at path with correct URL');
            return resolve(cloneDir);
          } else {
            throw new Error(`Directory ${cloneDir} already exists with a different repository (${existingUrl}). Expected: ${githubUrl}`);
          }
        } catch (gitError) {
          throw new Error(`Directory ${cloneDir} already exists but is not a valid git repository or git command failed`);
        }
      } catch (accessError) {
        // Directory doesn't exist - proceed with clone
      }

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(cloneDir), { recursive: true });

      // Prepare the git clone URL with authentication if token is provided
      let cloneUrl = githubUrl;
      if (githubToken) {
        // Convert HTTPS URL to authenticated URL
        // Example: https://github.com/user/repo -> https://token@github.com/user/repo
        cloneUrl = githubUrl.replace('https://github.com', `https://${githubToken}@github.com`);
      }

      logger.info({ githubUrl, cloneDir }, 'Cloning repository');

      // Execute git clone
      const gitProcess = spawn('git', ['clone', '--depth', '1', cloneUrl, cloneDir], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug({ stderr: data.toString() }, 'Git stderr output');
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          logger.info({ cloneDir, githubUrl }, 'Repository cloned successfully');
          resolve(cloneDir);
        } else {
          logger.error({ stderr, code, githubUrl, cloneDir }, 'Git clone failed');
          reject(new Error(`Git clone failed: ${stderr}`));
        }
      });

      gitProcess.on('error', (error) => {
        reject(new Error(`Failed to execute git: ${error.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 清理临时项目目录及其 Claude 会话
 * @param {string} projectPath - 项目目录的路径
 * @param {string} sessionId - 要清理的会话 ID
 */
async function cleanupProject(projectPath, sessionId = null) {
  const startTime = Date.now();

  logger.info({ projectPath, sessionId, timestamp: new Date().toISOString() }, 'cleanupProject START');

  try {
    // Only clean up projects in the external-projects directory
    if (!projectPath.includes('.claude/external-projects')) {
      logger.info({ projectPath }, 'cleanupProject SKIP - Project path does not contain .claude/external-projects');
      return;
    }

    logger.info({ projectPath }, 'cleanupProject VALIDATION - Cleaning up project');

    await fs.rm(projectPath, { recursive: true, force: true });

    const duration = Date.now() - startTime;
    logger.info({ projectPath, duration }, 'cleanupProject Project cleaned up successfully');

    // Also clean up the Claude session directory if sessionId provided
    if (sessionId) {
      try {
        const sessionPath = path.join(os.homedir(), '.claude', 'sessions', sessionId);
        logger.info({ sessionPath, sessionId }, 'cleanupProject Cleaning up session directory');
        await fs.rm(sessionPath, { recursive: true, force: true });
        logger.info({ sessionId }, 'cleanupProject Session directory cleaned up');
      } catch (error) {
        logger.warn({ sessionId, error: error.message }, 'cleanupProject Failed to clean up session directory');
      }
    }

    logger.info({ duration: Date.now() - startTime, projectPath }, 'cleanupProject COMPLETE');

  } catch (error) {
    logger.error({ error: error.message, projectPath, stack: error.stack }, 'cleanupProject FAILED');
  }
}

/**
 * SSE 流写入器 - 将 SDK/CLI 输出适配到服务器发送事件
 */
class SSEStreamWriter {
  constructor(res) {
    this.res = res;
    this.sessionId = null;
    this.isSSEStreamWriter = true;  // Marker for transport detection
  }

  send(data) {
    if (this.res.writableEnded) {
      return;
    }

    // Format as SSE - providers send raw objects, we stringify
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  end() {
    if (!this.res.writableEnded) {
      this.res.write('data: {"type":"done"}\n\n');
      this.res.end();
    }
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  getSessionId() {
    return this.sessionId;
  }
}

/**
 * 非流式响应收集器
 */
class ResponseCollector {
  constructor() {
    this.messages = [];
    this.sessionId = null;
  }

  send(data) {
    // Store ALL messages for now - we'll filter when returning
    this.messages.push(data);

    // Extract sessionId if present
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.sessionId) {
          this.sessionId = parsed.sessionId;
        }
      } catch (e) {
        // Not JSON, ignore
      }
    } else if (data && data.sessionId) {
      this.sessionId = data.sessionId;
    }
  }

  end() {
    // Do nothing - we'll collect all messages
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  getSessionId() {
    return this.sessionId;
  }

  getMessages() {
    return this.messages;
  }

  /**
   * 仅获取过滤后的助手消息
   */
  getAssistantMessages() {
    const assistantMessages = [];

    for (const msg of this.messages) {
      // Skip initial status message
      if (msg && msg.type === 'status') {
        continue;
      }

      // Handle JSON strings
      if (typeof msg === 'string') {
        try {
          const parsed = JSON.parse(msg);
          // Only include claude-response messages with assistant type
          if (parsed.type === 'claude-response' && parsed.data && parsed.data.type === 'assistant') {
            assistantMessages.push(parsed.data);
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }

    return assistantMessages;
  }

  /**
   * 计算所有消息的总令牌数
   */
  getTotalTokens() {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheCreation = 0;

    for (const msg of this.messages) {
      let data = msg;

      // Parse if string
      if (typeof msg === 'string') {
        try {
          data = JSON.parse(msg);
        } catch (e) {
          continue;
        }
      }

      // Extract usage from claude-response messages
      if (data && data.type === 'claude-response' && data.data) {
        const msgData = data.data;
        if (msgData.message && msgData.message.usage) {
          const usage = msgData.message.usage;
          totalInput += usage.input_tokens || 0;
          totalOutput += usage.output_tokens || 0;
          totalCacheRead += usage.cache_read_input_tokens || 0;
          totalCacheCreation += usage.cache_creation_input_tokens || 0;
        }
      }
    }

    return {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      totalTokens: totalInput + totalOutput + totalCacheRead + totalCacheCreation
    };
  }
}

// ===============================
// 外部 API 端点
// ===============================

/**
 * POST /api/agent
 *
 * Trigger an AI agent (Claude or Cursor) to work on a project.
 * Supports automatic GitHub branch and pull request creation after successful completion.
 *
 * ================================================================================================
 * REQUEST BODY PARAMETERS
 * ================================================================================================
 *
 * @param {string} githubUrl - (Conditionally Required) GitHub repository URL to clone.
 *                             Supported formats:
 *                             - HTTPS: https://github.com/owner/repo
 *                             - HTTPS with .git: https://github.com/owner/repo.git
 *                             - SSH: git@github.com:owner/repo
 *                             - SSH with .git: git@github.com:owner/repo.git
 *
 * @param {string} projectPath - (Conditionally Required) Path to existing project OR destination for cloning.
 *                               Behavior depends on usage:
 *                               - If used alone: Must point to existing project directory
 *                               - If used with githubUrl: Target location for cloning
 *                               - If omitted with githubUrl: Auto-generates temporary path in ~/.claude/external-projects/
 *
 * @param {string} message - (Required) Task description for the AI agent. Used as:
 *                          - Instructions for the agent
 *                          - Source for auto-generated branch names (if createBranch=true and no branchName)
 *                          - Fallback for PR title if no commits are made
 *
 * @param {string} provider - (Optional) AI provider to use. Options: 'claude' | 'cursor'
 *                           Default: 'claude'
 *
 * @param {boolean} stream - (Optional) Enable Server-Sent Events (SSE) streaming for real-time updates.
 *                          Default: true
 *                          - true: Returns text/event-stream with incremental updates
 *                          - false: Returns complete JSON response after completion
 *
 * @param {string} model - (Optional) Model identifier for providers.
 *
 *                        Claude models: 'sonnet' (default), 'opus', 'haiku', 'opusplan', 'sonnet[1m]'
 *                        Cursor models: 'gpt-5' (default), 'gpt-5.2', 'gpt-5.2-high', 'sonnet-4.5', 'opus-4.5',
 *                                       'gemini-3-pro', 'composer-1', 'auto', 'gpt-5.1', 'gpt-5.1-high',
 *                                       'gpt-5.1-codex', 'gpt-5.1-codex-high', 'gpt-5.1-codex-max',
 *                                       'gpt-5.1-codex-max-high', 'opus-4.1', 'grok', and thinking variants
 *                        Codex models: 'gpt-5.2' (default), 'gpt-5.1-codex-max', 'o3', 'o4-mini'
 *
 * @param {boolean} cleanup - (Optional) Auto-cleanup project directory after completion.
 *                           Default: true
 *                           Behavior:
 *                           - Only applies when cloning via githubUrl (not for existing projectPath)
 *                           - Deletes cloned repository after 5 seconds
 *                           - Also deletes associated Claude session directory
 *                           - Remote branch and PR remain on GitHub if created
 *
 * @param {string} githubToken - (Optional) GitHub Personal Access Token for authentication.
 *                              Overrides stored token from user settings.
 *                              Required for:
 *                              - Private repositories
 *                              - Branch/PR creation features
 *                              Token must have 'repo' scope for full functionality.
 *
 * @param {string} branchName - (Optional) Custom name for the Git branch.
 *                             If provided, createBranch is automatically set to true.
 *                             Validation rules (errors returned if violated):
 *                             - Cannot be empty or whitespace only
 *                             - Cannot start or end with dot (.)
 *                             - Cannot contain consecutive dots (..)
 *                             - Cannot contain spaces
 *                             - Cannot contain special characters: ~ ^ : ? * [ \
 *                             - Cannot contain @{
 *                             - Cannot start or end with forward slash (/)
 *                             - Cannot contain consecutive slashes (//)
 *                             - Cannot end with .lock
 *                             - Cannot contain ASCII control characters
 *                             Examples: 'feature/user-auth', 'bugfix/login-error', 'refactor/db-optimization'
 *
 * @param {boolean} createBranch - (Optional) Create a new Git branch after successful agent completion.
 *                                Default: false (or true if branchName is provided)
 *                                Behavior:
 *                                - Creates branch locally and pushes to remote
 *                                - If branch exists locally: Checks out existing branch (no error)
 *                                - If branch exists on remote: Uses existing branch (no error)
 *                                - Branch name: Custom (if branchName provided) or auto-generated from message
 *                                - Requires either githubUrl OR projectPath with GitHub remote
 *
 * @param {boolean} createPR - (Optional) Create a GitHub Pull Request after successful completion.
 *                            Default: false
 *                            Behavior:
 *                            - PR title: First commit message (or fallback to message parameter)
 *                            - PR description: Auto-generated from all commit messages
 *                            - Base branch: Always 'main' (currently hardcoded)
 *                            - If PR already exists: GitHub returns error with details
 *                            - Requires either githubUrl OR projectPath with GitHub remote
 *
 * ================================================================================================
 * PATH HANDLING BEHAVIOR
 * ================================================================================================
 *
 * Scenario 1: Only githubUrl provided
 *   Input:  { githubUrl: "https://github.com/owner/repo" }
 *   Action: Clones to auto-generated temporary path: ~/.claude/external-projects/<hash>/
 *   Cleanup: Yes (if cleanup=true)
 *
 * Scenario 2: Only projectPath provided
 *   Input:  { projectPath: "/home/user/my-project" }
 *   Action: Uses existing project at specified path
 *   Validation: Path must exist and be accessible
 *   Cleanup: No (never cleanup existing projects)
 *
 * Scenario 3: Both githubUrl and projectPath provided
 *   Input:  { githubUrl: "https://github.com/owner/repo", projectPath: "/custom/path" }
 *   Action: Clones githubUrl to projectPath location
 *   Validation:
 *     - If projectPath exists with git repo:
 *       - Compares remote URL with githubUrl
 *       - If URLs match: Reuses existing repo
 *       - If URLs differ: Returns error
 *   Cleanup: Yes (if cleanup=true)
 *
 * ================================================================================================
 * GITHUB BRANCH/PR CREATION REQUIREMENTS
 * ================================================================================================
 *
 * For createBranch or createPR to work, one of the following must be true:
 *
 * Option A: githubUrl provided
 *   - Repository URL directly specified
 *   - Works with both cloning and existing paths
 *
 * Option B: projectPath with GitHub remote
 *   - Project must be a Git repository
 *   - Must have 'origin' remote configured
 *   - Remote URL must point to github.com
 *   - System auto-detects GitHub URL via: git remote get-url origin
 *
 * Additional Requirements:
 *   - Valid GitHub token (from settings or githubToken parameter)
 *   - Token must have 'repo' scope for private repos
 *   - Project must have commits (for PR creation)
 *
 * ================================================================================================
 * VALIDATION & ERROR HANDLING
 * ================================================================================================
 *
 * Input Validations (400 Bad Request):
 *   - Either githubUrl OR projectPath must be provided (not neither)
 *   - message must be non-empty string
 *   - provider must be 'claude' or 'cursor'
 *   - createBranch/createPR requires githubUrl OR projectPath (not neither)
 *   - branchName must pass Git naming rules (if provided)
 *
 * Runtime Validations (500 Internal Server Error or specific error in response):
 *   - projectPath must exist (if used alone)
 *   - GitHub URL format must be valid
 *   - Git remote URL must include github.com (for projectPath + branch/PR)
 *   - GitHub token must be available (for private repos and branch/PR)
 *   - Directory conflicts handled (existing path with different repo)
 *
 * Branch Name Validation Errors (returned in response, not HTTP error):
 *   Invalid names return: { branch: { error: "Invalid branch name: <reason>" } }
 *   Examples:
 *   - "my branch" → "Branch name cannot contain spaces"
 *   - ".feature" → "Branch name cannot start with a dot"
 *   - "feature.lock" → "Branch name cannot end with .lock"
 *
 * ================================================================================================
 * RESPONSE FORMATS
 * ================================================================================================
 *
 * Streaming Response (stream=true):
 *   Content-Type: text/event-stream
 *   Events:
 *     - { type: "status", message: "...", projectPath: "..." }
 *     - { type: "claude-response", data: {...} }
 *     - { type: "github-branch", branch: { name: "...", url: "..." } }
 *     - { type: "github-pr", pullRequest: { number: 42, url: "..." } }
 *     - { type: "github-error", error: "..." }
 *     - { type: "done" }
 *
 * Non-Streaming Response (stream=false):
 *   Content-Type: application/json
 *   {
 *     success: true,
 *     sessionId: "session-123",
 *     messages: [...],        // Assistant messages only (filtered)
 *     tokens: {
 *       inputTokens: 150,
 *       outputTokens: 50,
 *       cacheReadTokens: 0,
 *       cacheCreationTokens: 0,
 *       totalTokens: 200
 *     },
 *     projectPath: "/path/to/project",
 *     branch: {               // Only if createBranch=true
 *       name: "feature/xyz",
 *       url: "https://github.com/owner/repo/tree/feature/xyz"
 *     } | { error: "..." },
 *     pullRequest: {          // Only if createPR=true
 *       number: 42,
 *       url: "https://github.com/owner/repo/pull/42"
 *     } | { error: "..." }
 *   }
 *
 * Error Response:
 *   HTTP Status: 400, 401, 500
 *   Content-Type: application/json
 *   { success: false, error: "Error description" }
 *
 * ================================================================================================
 * EXAMPLES
 * ================================================================================================
 *
 * Example 1: Clone and process with auto-cleanup
 *   POST /api/agent
 *   { "githubUrl": "https://github.com/user/repo", "message": "Fix bug" }
 *
 * Example 2: Use existing project with custom branch and PR
 *   POST /api/agent
 *   {
 *     "projectPath": "/home/user/project",
 *     "message": "Add feature",
 *     "branchName": "feature/new-feature",
 *     "createPR": true
 *   }
 *
 * Example 3: Clone to specific path with auto-generated branch
 *   POST /api/agent
 *   {
 *     "githubUrl": "https://github.com/user/repo",
 *     "projectPath": "/tmp/work",
 *     "message": "Refactor code",
 *     "createBranch": true,
 *     "cleanup": false
 *   }
 */
router.post('/', validateExternalApiKey, async (req, res) => {
  const { githubUrl, projectPath, message, provider = 'claude', model, githubToken, branchName } = req.body;

  // Parse stream and cleanup as booleans (handle string "true"/"false" from curl)
  const stream = req.body.stream === undefined ? true : (req.body.stream === true || req.body.stream === 'true');
  const cleanup = req.body.cleanup === undefined ? true : (req.body.cleanup === true || req.body.cleanup === 'true');

  // If branchName is provided, automatically enable createBranch
  const createBranch = branchName ? true : (req.body.createBranch === true || req.body.createBranch === 'true');
  const createPR = req.body.createPR === true || req.body.createPR === 'true';

  // Validate inputs
  if (!githubUrl && !projectPath) {
    return res.status(400).json({ error: 'Either githubUrl or projectPath is required' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (!['claude', 'cursor', 'codex'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be "claude", "cursor", or "codex"' });
  }

  // Validate GitHub branch/PR creation requirements
  // Allow branch/PR creation with projectPath as long as it has a GitHub remote
  if ((createBranch || createPR) && !githubUrl && !projectPath) {
    return res.status(400).json({ error: 'createBranch and createPR require either githubUrl or projectPath with a GitHub remote' });
  }

  let finalProjectPath = null;
  let writer = null;

  try {
    // Determine the final project path
    if (githubUrl) {
      // Clone repository (to projectPath if provided, otherwise generate path)
      const tokenToUse = githubToken || GitHubToken.getActive(req.user.userId);

      let targetPath;
      if (projectPath) {
        targetPath = projectPath;
      } else {
        // Generate a unique path for cloning
        const repoHash = crypto.createHash('md5').update(githubUrl + Date.now()).digest('hex');
        targetPath = path.join(os.homedir(), '.claude', 'external-projects', repoHash);
      }

      finalProjectPath = await cloneGitHubRepo(githubUrl.trim(), tokenToUse, targetPath);
    } else {
      // Use existing project path
      finalProjectPath = path.resolve(projectPath);

      // Verify the path exists
      try {
        await fs.access(finalProjectPath);
      } catch (error) {
        throw new Error(`Project path does not exist: ${finalProjectPath}`);
      }
    }

    // Register the project (or use existing registration)
    let project;
    try {
      // 容器模式：从路径提取项目名称并注册
      // 如果是完整路径，取最后一部分作为项目名
      const projectName = path.basename(finalProjectPath);
      project = await addProjectManually(req.user.userId, projectName);
      logger.info({ project }, 'Project registered');
    } catch (error) {
      // If project already exists, that's fine - continue with the existing registration
      if (error.message && error.message.includes('Project already configured')) {
        logger.info({ finalProjectPath }, 'Using existing project registration');
        project = { path: finalProjectPath };
      } else {
        throw error;
      }
    }

    // Set up writer based on streaming mode
    if (stream) {
      // Set up SSE headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      writer = new SSEStreamWriter(res);

      // Send initial status
      writer.send({
        type: 'status',
        message: githubUrl ? 'Repository cloned and session started' : 'Session started',
        projectPath: finalProjectPath
      });
    } else {
      // Non-streaming mode: collect messages
      writer = new ResponseCollector();

      // Collect initial status message
      writer.send({
        type: 'status',
        message: githubUrl ? 'Repository cloned and session started' : 'Session started',
        projectPath: finalProjectPath
      });
    }

    // Start the appropriate session
    if (provider === 'claude') {
      logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Claude SDK session');

      await queryClaudeSDK(message.trim(), {
        projectPath: finalProjectPath,
        cwd: finalProjectPath,
        sessionId: null, // New session
        model: model,
        permissionMode: 'bypassPermissions' // Bypass all permissions for API calls
      }, writer);

    } else if (provider === 'cursor') {
      logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Cursor CLI session');

      await spawnCursor(message.trim(), {
        projectPath: finalProjectPath,
        cwd: finalProjectPath,
        sessionId: null, // New session
        model: model || undefined,
        skipPermissions: true // Bypass permissions for Cursor
      }, writer);
    } else if (provider === 'codex') {
      logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Codex SDK session');

      await queryCodex(message.trim(), {
        projectPath: finalProjectPath,
        cwd: finalProjectPath,
        sessionId: null,
        model: model || CODEX_MODELS.DEFAULT,
        permissionMode: 'bypassPermissions'
      }, writer);
    }

    // Handle GitHub branch and PR creation after successful agent completion
    let branchInfo = null;
    let prInfo = null;

    if (createBranch || createPR) {
      try {
        logger.info({ createBranch, createPR }, 'Starting GitHub branch/PR creation workflow');

        // Get GitHub token
        const tokenToUse = githubToken || GitHubToken.getActive(req.user.userId);

        if (!tokenToUse) {
          throw new Error('GitHub token required for branch/PR creation. Please configure a GitHub token in settings.');
        }

        // Initialize Octokit
        const octokit = new Octokit({ auth: tokenToUse });

        // Get GitHub URL - either from parameter or from git remote
        let repoUrl = githubUrl;
        if (!repoUrl) {
          logger.info({ projectPath: finalProjectPath }, 'Getting GitHub URL from git remote');
          try {
            repoUrl = await getGitRemoteUrl(finalProjectPath);
            if (!repoUrl.includes('github.com')) {
              throw new Error('Project does not have a GitHub remote configured');
            }
            logger.info({ repoUrl }, 'Found GitHub remote');
          } catch (error) {
            throw new Error(`Failed to get GitHub remote URL: ${error.message}`);
          }
        }

        // Parse GitHub URL to get owner and repo
        const { owner, repo } = parseGitHubUrl(repoUrl);
        logger.info({ owner, repo }, 'Repository info');

        // Use provided branch name or auto-generate from message
        const finalBranchName = branchName || autogenerateBranchName(message);
        if (branchName) {
          logger.info({ finalBranchName }, 'Using provided branch name');

          // Validate custom branch name
          const validation = validateBranchName(finalBranchName);
          if (!validation.valid) {
            throw new Error(`Invalid branch name: ${validation.error}`);
          }
        } else {
          logger.info({ finalBranchName }, 'Auto-generated branch name');
        }

        if (createBranch) {
          // Create and checkout the new branch locally
          logger.info({ finalBranchName }, 'Creating local branch');
          const checkoutProcess = spawn('git', ['checkout', '-b', finalBranchName], {
            cwd: finalProjectPath,
            stdio: 'pipe'
          });

          await new Promise((resolve, reject) => {
            let stderr = '';
            checkoutProcess.stderr.on('data', (data) => { stderr += data.toString(); });
            checkoutProcess.on('close', (code) => {
              if (code === 0) {
                logger.info({ finalBranchName }, 'Created and checked out local branch');
                resolve();
              } else {
                // Branch might already exist locally, try to checkout
                if (stderr.includes('already exists')) {
                  logger.info({ finalBranchName }, 'Branch already exists locally, checking out');
                  const checkoutExisting = spawn('git', ['checkout', finalBranchName], {
                    cwd: finalProjectPath,
                    stdio: 'pipe'
                  });
                  checkoutExisting.on('close', (checkoutCode) => {
                    if (checkoutCode === 0) {
                      logger.info({ finalBranchName }, 'Checked out existing branch');
                      resolve();
                    } else {
                      reject(new Error(`Failed to checkout existing branch: ${stderr}`));
                    }
                  });
                } else {
                  reject(new Error(`Failed to create branch: ${stderr}`));
                }
              }
            });
          });

          // Push the branch to remote
          logger.info({ finalBranchName }, 'Pushing branch to remote');
          const pushProcess = spawn('git', ['push', '-u', 'origin', finalBranchName], {
            cwd: finalProjectPath,
            stdio: 'pipe'
          });

          await new Promise((resolve, reject) => {
            let stderr = '';
            let stdout = '';
            pushProcess.stdout.on('data', (data) => { stdout += data.toString(); });
            pushProcess.stderr.on('data', (data) => { stderr += data.toString(); });
            pushProcess.on('close', (code) => {
              if (code === 0) {
                logger.info({ finalBranchName }, 'Pushed branch to remote');
                resolve();
              } else {
                // Check if branch exists on remote but has different commits
                if (stderr.includes('already exists') || stderr.includes('up-to-date')) {
                  logger.info({ finalBranchName }, 'Branch already exists on remote, using existing branch');
                  resolve();
                } else {
                  reject(new Error(`Failed to push branch: ${stderr}`));
                }
              }
            });
          });

          branchInfo = {
            name: finalBranchName,
            url: `https://github.com/${owner}/${repo}/tree/${finalBranchName}`
          };
        }

        if (createPR) {
          // Get commit messages to generate PR description
          logger.info({ projectPath: finalProjectPath }, 'Generating PR title and description');
          const commitMessages = await getCommitMessages(finalProjectPath, 5);

          // Use the first commit message as the PR title, or fallback to the agent message
          const prTitle = commitMessages.length > 0 ? commitMessages[0] : message;

          // Generate PR body from commit messages
          let prBody = '## Changes\n\n';
          if (commitMessages.length > 0) {
            prBody += commitMessages.map(msg => `- ${msg}`).join('\n');
          } else {
            prBody += `Agent task: ${message}`;
          }
          prBody += '\n\n---\n*This pull request was automatically created by Claude Code UI Agent.*';

          logger.info({ prTitle, commitCount: commitMessages.length }, 'PR title and description generated');

          // Create the pull request
          logger.info({ finalBranchName, owner, repo }, 'Creating pull request');
          prInfo = await createGitHubPR(octokit, owner, repo, finalBranchName, prTitle, prBody, 'main');
        }

        // Send branch/PR info in response
        if (stream) {
          if (branchInfo) {
            writer.send({
              type: 'github-branch',
              branch: branchInfo
            });
          }
          if (prInfo) {
            writer.send({
              type: 'github-pr',
              pullRequest: prInfo
            });
          }
        }

      } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'GitHub branch/PR creation error');

        // Send error but don't fail the entire request
        if (stream) {
          writer.send({
            type: 'github-error',
            error: error.message
          });
        }
        // Store error info for non-streaming response
        if (!stream) {
          branchInfo = { error: error.message };
          prInfo = { error: error.message };
        }
      }
    }

    // Handle response based on streaming mode
    if (stream) {
      // Streaming mode: end the SSE stream
      writer.end();
    } else {
      // Non-streaming mode: send filtered messages and token summary as JSON
      const assistantMessages = writer.getAssistantMessages();
      const tokenSummary = writer.getTotalTokens();

      const response = {
        success: true,
        sessionId: writer.getSessionId(),
        messages: assistantMessages,
        tokens: tokenSummary,
        projectPath: finalProjectPath
      };

      // Add branch/PR info if created
      if (branchInfo) {
        response.branch = branchInfo;
      }
      if (prInfo) {
        response.pullRequest = prInfo;
      }

      res.json(response);
    }

    // Clean up if requested
    if (cleanup && githubUrl) {
      // Only cleanup if we cloned a repo (not for existing project paths)
      const sessionIdForCleanup = writer.getSessionId();
      setTimeout(() => {
        cleanupProject(finalProjectPath, sessionIdForCleanup);
      }, 5000);
    }

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'External session error');

    // Clean up on error
    if (finalProjectPath && cleanup && githubUrl) {
      const sessionIdForCleanup = writer ? writer.getSessionId() : null;
      cleanupProject(finalProjectPath, sessionIdForCleanup);
    }

    if (stream) {
      // For streaming, send error event and stop
      if (!writer) {
        // Set up SSE headers if not already done
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        writer = new SSEStreamWriter(res);
      }

      if (!res.writableEnded) {
        writer.send({
          type: 'error',
          error: error.message,
          message: `Failed: ${error.message}`
        });
        writer.end();
      }
    } else if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

export default router;
