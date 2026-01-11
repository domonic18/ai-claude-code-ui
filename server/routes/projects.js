import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import { addProjectManually, getProjects, renameProject, deleteProject } from '../services/project/index.js';
import { getFileOperations } from '../config/container-config.js';
import { getProjectsInContainer } from '../services/container/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 配置允许的工作空间根目录（默认为用户主目录）
const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || os.homedir();

// 不应作为工作空间目录的系统关键路径
const FORBIDDEN_PATHS = [
  '/',
  '/etc',
  '/bin',
  '/sbin',
  '/usr',
  '/dev',
  '/proc',
  '/sys',
  '/var',
  '/boot',
  '/root',
  '/lib',
  '/lib64',
  '/opt',
  '/tmp',
  '/run'
];

/**
 * 验证路径对工作空间操作是否安全
 * @param {string} requestedPath - 要验证的路径
 * @returns {Promise<{valid: boolean, resolvedPath?: string, error?: string}>}
 */
async function validateWorkspacePath(requestedPath) {
  try {
    // 解析为绝对路径
    let absolutePath = path.resolve(requestedPath);

    // 检查路径是否为禁止的系统目录
    const normalizedPath = path.normalize(absolutePath);
    if (FORBIDDEN_PATHS.includes(normalizedPath) || normalizedPath === '/') {
      return {
        valid: false,
        error: 'Cannot use system-critical directories as workspace locations'
      };
    }

    // 对以禁止目录开头的路径进行额外检查
    for (const forbidden of FORBIDDEN_PATHS) {
      if (normalizedPath === forbidden ||
          normalizedPath.startsWith(forbidden + path.sep)) {
        // 例外：/var/tmp 和类似用户可访问的路径可能被允许
        // 但 /var 本身和大多数 /var 子目录应该被阻止
        if (forbidden === '/var' &&
            (normalizedPath.startsWith('/var/tmp') ||
             normalizedPath.startsWith('/var/folders'))) {
          continue; // 允许这些特定情况
        }

        return {
          valid: false,
          error: `Cannot create workspace in system directory: ${forbidden}`
        };
      }
    }

    // 尝试解析真实路径（跟随符号链接）
    let realPath;
    try {
      // 检查路径是否存在以解析真实路径
      await fs.access(absolutePath);
      realPath = await fs.realpath(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 路径尚不存在 - 检查父目录
        let parentPath = path.dirname(absolutePath);
        try {
          const parentRealPath = await fs.realpath(parentPath);

          // 使用真实父目录重建完整路径
          realPath = path.join(parentRealPath, path.basename(absolutePath));
        } catch (parentError) {
          if (parentError.code === 'ENOENT') {
            // 父目录也不存在 - 使用绝对路径原样
            // 我们将验证它在允许的根目录内
            realPath = absolutePath;
          } else {
            throw parentError;
          }
        }
      } else {
        throw error;
      }
    }

    // 将工作空间根目录解析为其真实路径
    const resolvedWorkspaceRoot = await fs.realpath(WORKSPACES_ROOT);

    // 确保解析的路径包含在允许的工作空间根目录内
    if (!realPath.startsWith(resolvedWorkspaceRoot + path.sep) &&
        realPath !== resolvedWorkspaceRoot) {
      return {
        valid: false,
        error: `Workspace path must be within the allowed workspace root: ${WORKSPACES_ROOT}`
      };
    }

    // 对现有路径进行额外的符号链接检查
    try {
      await fs.access(absolutePath);
      const stats = await fs.lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        // 验证符号链接目标也在允许的根目录内
        const linkTarget = await fs.readlink(absolutePath);
        const resolvedTarget = path.resolve(path.dirname(absolutePath), linkTarget);
        const realTarget = await fs.realpath(resolvedTarget);

        if (!realTarget.startsWith(resolvedWorkspaceRoot + path.sep) &&
            realTarget !== resolvedWorkspaceRoot) {
          return {
            valid: false,
            error: 'Symlink target is outside the allowed workspace root'
          };
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // 路径不存在 - 这对于新工作空间创建来说没问题
    }

    return {
      valid: true,
      resolvedPath: realPath
    };

  } catch (error) {
    return {
      valid: false,
      error: `Path validation failed: ${error.message}`
    };
  }
}

/**
 * GET /api/projects
 * 获取所有项目列表
 * 支持容器模式和主机模式
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('[DEBUG] Get projects request - userId:', userId);

    // 检查是否启用容器模式
    const fileOps = await getFileOperations(userId);
    console.log('[DEBUG] File operations mode:', fileOps.isContainer ? 'CONTAINER' : 'HOST');

    let projects;
    if (fileOps.isContainer) {
      // 容器模式：从容器获取项目
      console.log('[DEBUG] Using container mode for projects');
      projects = await getProjectsInContainer(userId);
    } else {
      // 主机模式：从主机文件系统获取项目
      console.log('[DEBUG] Using host mode for projects');
      projects = await getProjects();
    }

    res.json(projects);
  } catch (error) {
    console.error('[ERROR] Failed to get projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/projects/:projectName/rename
 * 重命名项目的显示名称
 */
router.put('/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    await renameProject(req.params.projectName, displayName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:projectName
 * 删除项目（仅当为空时）
 */
router.delete('/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    await deleteProject(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/projects/create
 * 通过手动添加路径来创建新项目
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { path: projectPath } = req.body;

    if (!projectPath || !projectPath.trim()) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const project = await addProjectManually(projectPath.trim());
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建新工作空间
 * POST /api/projects/create-workspace
 *
 * 请求体：
 * - workspaceType: 'existing' | 'new'
 * - path: string（工作空间路径）
 * - githubUrl?: string（可选，用于新工作空间）
 * - githubTokenId?: number（可选，存储的令牌 ID）
 * - newGithubToken?: string（可选，一次性令牌）
 */
router.post('/create-workspace', async (req, res) => {
  try {
    const { workspaceType, path: workspacePath, githubUrl, githubTokenId, newGithubToken } = req.body;

    // 验证必填字段
    if (!workspaceType || !workspacePath) {
      return res.status(400).json({ error: 'workspaceType and path are required' });
    }

    if (!['existing', 'new'].includes(workspaceType)) {
      return res.status(400).json({ error: 'workspaceType must be "existing" or "new"' });
    }

    // 在任何操作之前验证路径安全性
    const validation = await validateWorkspacePath(workspacePath);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid workspace path',
        details: validation.error
      });
    }

    const absolutePath = validation.resolvedPath;

    // 处理现有工作空间
    if (workspaceType === 'existing') {
      // 检查路径是否存在
      try {
        await fs.access(absolutePath);
        const stats = await fs.stat(absolutePath);

        if (!stats.isDirectory()) {
          return res.status(400).json({ error: 'Path exists but is not a directory' });
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Workspace path does not exist' });
        }
        throw error;
      }

      // 将现有工作空间添加到项目列表
      const project = await addProjectManually(absolutePath);

      return res.json({
        success: true,
        project,
        message: 'Existing workspace added successfully'
      });
    }

    // 处理新工作空间创建
    if (workspaceType === 'new') {
      // 检查路径是否已存在
      try {
        await fs.access(absolutePath);
        return res.status(400).json({
          error: 'Path already exists. Please choose a different path or use "existing workspace" option.'
        });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // 路径不存在 - 很好，我们可以创建它
      }

      // 创建目录
      await fs.mkdir(absolutePath, { recursive: true });

      // 如果提供了 GitHub URL，则克隆仓库
      if (githubUrl) {
        let githubToken = null;

        // 如果需要，获取 GitHub 令牌
        if (githubTokenId) {
          // 从数据库获取令牌
          const token = await getGithubTokenById(githubTokenId, req.user.userId);
          if (!token) {
            // 清理已创建的目录
            await fs.rm(absolutePath, { recursive: true, force: true });
            return res.status(404).json({ error: 'GitHub token not found' });
          }
          githubToken = token.github_token;
        } else if (newGithubToken) {
          githubToken = newGithubToken;
        }

        // 克隆仓库
        try {
          await cloneGitHubRepository(githubUrl, absolutePath, githubToken);
        } catch (error) {
          // 失败时清理已创建的目录
          try {
            await fs.rm(absolutePath, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('Failed to clean up directory after clone failure:', cleanupError);
            // 继续抛出原始错误
          }
          throw new Error(`Failed to clone repository: ${error.message}`);
        }
      }

      // 将新工作空间添加到项目列表
      const project = await addProjectManually(absolutePath);

      return res.json({
        success: true,
        project,
        message: githubUrl
          ? 'New workspace created and repository cloned successfully'
          : 'New workspace created successfully'
      });
    }

  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({
      error: error.message || 'Failed to create workspace',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 从数据库获取 GitHub 令牌的辅助函数
 */
async function getGithubTokenById(tokenId, userId) {
  const { getDatabase } = await import('../database/db.js');
  const db = await getDatabase();

  const credential = await db.get(
    'SELECT * FROM user_credentials WHERE id = ? AND user_id = ? AND credential_type = ? AND is_active = 1',
    [tokenId, userId, 'github_token']
  );

  // 以预期格式返回（为了兼容性使用 github_token 字段）
  if (credential) {
    return {
      ...credential,
      github_token: credential.credential_value
    };
  }

  return null;
}

/**
 * 克隆 GitHub 仓库的辅助函数
 */
function cloneGitHubRepository(githubUrl, destinationPath, githubToken = null) {
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
        // 解析 git 错误消息以提供有用的反馈
        let errorMessage = 'Git clone failed';

        if (stderr.includes('Authentication failed') || stderr.includes('could not read Username')) {
          errorMessage = 'Authentication failed. Please check your GitHub token.';
        } else if (stderr.includes('Repository not found')) {
          errorMessage = 'Repository not found. Please check the URL and ensure you have access.';
        } else if (stderr.includes('already exists')) {
          errorMessage = 'Directory already exists';
        } else if (stderr) {
          errorMessage = stderr;
        }

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

export default router;
