/**
 * Git API 路由
 * =============
 *
 * 提供 Git 版本控制的 HTTP API 端点。
 * 路由层仅负责：参数校验、调用 GitService、格式化响应。
 * 所有 git 操作委托给 services/scm/GitService。
 *
 * @module routes/api/git
 */

import express from 'express';
import {
    resolveProjectPath,
    getStatus,
    getFileDiff,
    getFileWithDiff,
    getCommits,
    getCommitDiff,
    getRemoteStatus,
    getBranches,
    createInitialCommit,
    commitFiles,
    checkoutBranch,
    createBranch,
    fetchFromRemote,
    pullFromRemote,
    pushToRemote,
    publishBranch,
    discardChanges,
    deleteUntracked,
    generateCommitMessage
} from '../../services/scm/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/api/git');
const router = express.Router();

// ─── 状态查询路由 ──────────────────────────────────────

/**
 * GET /status - 获取项目的 git 状态
 */
router.get('/status', async (req, res) => {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await getStatus(projectPath);
        res.json(result);
    } catch (error) {
        logger.error('Git status error:', error);
        res.status(500).json({
            error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
                ? error.message : 'Git operation failed',
            details: error.message
        });
    }
});

/**
 * GET /diff - 获取特定文件的 diff
 */
router.get('/diff', async (req, res) => {
    const { project, file } = req.query;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const diff = await getFileDiff(projectPath, file);
        res.json({ diff });
    } catch (error) {
        logger.error('Git diff error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /file-with-diff - 获取文件内容和 diff 信息
 */
router.get('/file-with-diff', async (req, res) => {
    const { project, file } = req.query;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await getFileWithDiff(projectPath, file);
        res.json(result);
    } catch (error) {
        logger.error('Git file-with-diff error:', error);
        if (error.message.includes('Cannot show diff for directories')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /branches - 获取分支列表
 */
router.get('/branches', async (req, res) => {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const branches = await getBranches(projectPath);
        res.json({ branches });
    } catch (error) {
        logger.error('Git branches error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /commits - 获取最近的提交
 */
router.get('/commits', async (req, res) => {
    const { project, limit = 10 } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 500);

    try {
        const projectPath = await resolveProjectPath(project);
        const commits = await getCommits(projectPath, safeLimit);
        res.json({ commits });
    } catch (error) {
        logger.error('Git commits error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /commit-diff - 获取特定提交的 diff
 */
router.get('/commit-diff', async (req, res) => {
    const { project, commit } = req.query;
    if (!project || !commit) return res.status(400).json({ error: 'Project name and commit hash are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const diff = await getCommitDiff(projectPath, commit);
        res.json({ diff });
    } catch (error) {
        logger.error('Git commit diff error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /remote-status - 获取远程状态
 */
router.get('/remote-status', async (req, res) => {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await getRemoteStatus(projectPath);
        res.json(result);
    } catch (error) {
        logger.error('Git remote status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── 提交操作路由 ──────────────────────────────────────

/**
 * POST /initial-commit - 创建初始提交
 */
router.post('/initial-commit', async (req, res) => {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await createInitialCommit(projectPath);
        res.json({ success: true, ...result, message: 'Initial commit created successfully' });
    } catch (error) {
        logger.error('Git initial commit error:', error);
        if (error.message.includes('already has commits')) return res.status(400).json({ error: error.message });
        if (error.message.includes('nothing to commit')) return res.status(400).json({ error: 'Nothing to commit', details: 'No files found in the repository. Add some files first.' });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /commit - 提交更改
 */
router.post('/commit', async (req, res) => {
    const { project, message, files } = req.body;
    if (!project || !message || !files || files.length === 0) {
        return res.status(400).json({ error: 'Project name, commit message, and files are required' });
    }

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await commitFiles(projectPath, files, message);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git commit error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /generate-commit-message - AI 生成提交消息
 */
router.post('/generate-commit-message', async (req, res) => {
    const { project, files, provider = 'claude' } = req.body;
    if (!project || !files || files.length === 0) return res.status(400).json({ error: 'Project name and files are required' });
    if (!['claude', 'cursor'].includes(provider)) return res.status(400).json({ error: 'provider must be "claude" or "cursor"' });

    try {
        const projectPath = await resolveProjectPath(project);
        const message = await generateCommitMessage(projectPath, files, provider);
        res.json({ message });
    } catch (error) {
        logger.error('Generate commit message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── 分支操作路由 ──────────────────────────────────────

/**
 * POST /checkout - 切换分支
 */
router.post('/checkout', async (req, res) => {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await checkoutBranch(projectPath, branch);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /create-branch - 创建新分支
 */
router.post('/create-branch', async (req, res) => {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch name are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await createBranch(projectPath, branch);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git create branch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── 远程操作路由 ──────────────────────────────────────

/**
 * POST /fetch - 从远程获取
 */
router.post('/fetch', async (req, res) => {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await fetchFromRemote(projectPath);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git fetch error:', error);
        res.status(500).json({ error: 'Fetch failed', details: classifyRemoteError(error) });
    }
});

/**
 * POST /pull - 从远程拉取
 */
router.post('/pull', async (req, res) => {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await pullFromRemote(projectPath);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git pull error:', error);
        res.status(500).json({ error: classifyPullError(error), details: classifyPullDetails(error) });
    }
});

/**
 * POST /push - 推送到远程
 */
router.post('/push', async (req, res) => {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await pushToRemote(projectPath);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git push error:', error);
        res.status(500).json({ error: classifyPushError(error), details: classifyPushDetails(error) });
    }
});

/**
 * POST /publish - 发布分支到远程
 */
router.post('/publish', async (req, res) => {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const result = await publishBranch(projectPath, branch);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Git publish error:', error);
        res.status(500).json({ error: classifyPublishError(error), details: classifyPublishDetails(error) });
    }
});

// ─── 文件操作路由 ──────────────────────────────────────

/**
 * POST /discard - 丢弃文件更改
 */
router.post('/discard', async (req, res) => {
    const { project, file } = req.body;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        await discardChanges(projectPath, file);
        res.json({ success: true, message: `Changes discarded for ${file}` });
    } catch (error) {
        logger.error('Git discard error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /delete-untracked - 删除未跟踪的文件
 */
router.post('/delete-untracked', async (req, res) => {
    const { project, file } = req.body;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });

    try {
        const projectPath = await resolveProjectPath(project);
        const isDir = await deleteUntracked(projectPath, file);
        res.json({ success: true, message: `Untracked ${isDir ? 'directory' : 'file'} ${file} deleted successfully` });
    } catch (error) {
        logger.error('Git delete untracked error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── 错误分类辅助函数 ──────────────────────────────────

/**
 * Git 错误分类规则表
 * 每条规则: { pattern: 匹配子串, error: 简短错误, detail: 详细说明 }
 */
const GIT_ERROR_RULES = [
    { pattern: 'CONFLICT', error: 'Merge conflicts detected', detail: 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.' },
    { pattern: 'Please commit your changes or stash them', error: 'Uncommitted changes detected', detail: 'Please commit or stash your local changes before pulling.' },
    { pattern: 'rejected', error: 'Push rejected', detail: 'The remote has newer commits. Pull first to merge changes before pushing.' },
    { pattern: 'non-fast-forward', error: 'Non-fast-forward push', detail: 'Your branch is behind the remote. Pull the latest changes first.' },
    { pattern: 'Could not resolve hostname', error: 'Network error', detail: 'Unable to connect to remote repository. Check your internet connection.' },
    { pattern: 'does not appear to be a git repository', error: 'Remote not configured', detail: 'No remote repository configured. Add a remote with: git remote add origin <url>' },
    { pattern: 'Permission denied', error: 'Authentication failed', detail: 'Permission denied. Check your credentials or SSH keys.' },
    { pattern: 'no upstream branch', error: 'No upstream branch', detail: 'No upstream branch configured. Use: git push --set-upstream origin <branch>' },
    { pattern: 'diverged', error: 'Branches have diverged', detail: 'Your local branch and remote branch have diverged. Consider fetching first to review changes.' },
];

/** 各操作允许匹配的 pattern 子集 */
const OPERATION_PATTERNS = {
    remote:  ['Could not resolve hostname', 'does not appear to be a git repository'],
    pull:    ['CONFLICT', 'Please commit your changes or stash them', 'Could not resolve hostname', 'does not appear to be a git repository', 'diverged'],
    push:    ['rejected', 'non-fast-forward', 'Could not resolve hostname', 'does not appear to be a git repository', 'Permission denied', 'no upstream branch'],
    publish: ['rejected', 'Could not resolve hostname', 'Permission denied', 'does not appear to be a git repository'],
};

/** publish 操作的特殊 detail 映射（覆盖 GIT_ERROR_RULES 的默认值） */
const PUBLISH_DETAIL_OVERRIDES = {
    'rejected': 'The remote branch already exists and has different commits. Use push instead.',
    'does not appear to be a git repository': 'Remote repository not properly configured. Check your remote URL.',
};

/**
 * 通用 Git 错误分类
 * @param {Error} error - 原始错误对象
 * @param {string} operation - 操作类型 (remote|pull|push|publish)
 * @param {'error'|'detail'} field - 返回简短错误还是详细说明
 * @returns {string} 分类后的错误信息
 */
function classifyGitError(error, operation, field) {
    const msg = error.message;
    const allowedPatterns = OPERATION_PATTERNS[operation] || [];

    for (const rule of GIT_ERROR_RULES) {
        if (allowedPatterns.includes(rule.pattern) && msg.includes(rule.pattern)) {
            if (field === 'error') return rule.error;
            // detail 可能有操作级覆盖
            if (operation === 'publish' && PUBLISH_DETAIL_OVERRIDES[rule.pattern]) {
                return PUBLISH_DETAIL_OVERRIDES[rule.pattern];
            }
            return rule.detail;
        }
    }

    // 默认返回值
    if (field === 'error') {
        const defaults = { remote: msg, pull: 'Pull failed', push: 'Push failed', publish: 'Publish failed' };
        return defaults[operation] || msg;
    }
    return msg;
}

/** 快捷包装函数 */
const classifyRemoteError  = (e) => classifyGitError(e, 'remote', 'error');
const classifyPullError    = (e) => classifyGitError(e, 'pull', 'error');
const classifyPullDetails  = (e) => classifyGitError(e, 'pull', 'detail');
const classifyPushError    = (e) => classifyGitError(e, 'push', 'error');
const classifyPushDetails  = (e) => classifyGitError(e, 'push', 'detail');
const classifyPublishError = (e) => classifyGitError(e, 'publish', 'error');
const classifyPublishDetails = (e) => classifyGitError(e, 'publish', 'detail');

export default router;
