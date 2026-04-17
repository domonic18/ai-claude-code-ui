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
import {
    classifyRemoteError,
    classifyPullError,
    classifyPullDetails,
    classifyPushError,
    classifyPushDetails,
    classifyPublishError,
    classifyPublishDetails
} from './gitErrorClassifier.js';

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

export default router;
