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

function gitHandler(handler, errorFormatter) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            logger.error(`Git ${req.path} error:`, error);
            const formatted = errorFormatter
                ? errorFormatter(error)
                : { error: error.message };
            res.status(500).json(formatted);
        }
    };
}

function formatGitStatusError(error) {
    const isGitRepoError = error.message.includes('not a git repository')
        || error.message.includes('Project directory is not a git repository');
    return {
        error: isGitRepoError ? error.message : 'Git operation failed',
        details: error.message
    };
}

function formatInitialCommitError(error) {
    if (error.message.includes('already has commits')) {
        return { status: 400, error: error.message };
    }
    if (error.message.includes('nothing to commit')) {
        return { status: 400, error: 'Nothing to commit', details: 'No files found in the repository. Add some files first.' };
    }
    return { status: 500, error: error.message };
}

function formatFileWithDiffError(error) {
    if (error.message.includes('Cannot show diff for directories')) {
        return { status: 400, error: error.message };
    }
    return { status: 500, error: error.message };
}

function gitHandlerWithStatus(handler, statusErrorFormatter) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            logger.error(`Git ${req.path} error:`, error);
            const result = statusErrorFormatter(error);
            res.status(result.status || 500).json(result);
        }
    };
}

// ─── 状态查询路由 ──────────────────────────────────────

router.get('/status', gitHandler(
    async (req, res) => {
        const { project } = req.query;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json(await getStatus(projectPath));
    },
    formatGitStatusError
));

router.get('/diff', gitHandler(
    async (req, res) => {
        const { project, file } = req.query;
        if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ diff: await getFileDiff(projectPath, file) });
    }
));

router.get('/file-with-diff', gitHandlerWithStatus(
    async (req, res) => {
        const { project, file } = req.query;
        if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
        const projectPath = await resolveProjectPath(project);
        res.json(await getFileWithDiff(projectPath, file));
    },
    formatFileWithDiffError
));

router.get('/branches', gitHandler(
    async (req, res) => {
        const { project } = req.query;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ branches: await getBranches(projectPath) });
    }
));

router.get('/commits', gitHandler(
    async (req, res) => {
        const { project, limit = 10 } = req.query;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 500);
        const projectPath = await resolveProjectPath(project);
        res.json({ commits: await getCommits(projectPath, safeLimit) });
    }
));

router.get('/commit-diff', gitHandler(
    async (req, res) => {
        const { project, commit } = req.query;
        if (!project || !commit) return res.status(400).json({ error: 'Project name and commit hash are required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ diff: await getCommitDiff(projectPath, commit) });
    }
));

router.get('/remote-status', gitHandler(
    async (req, res) => {
        const { project } = req.query;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json(await getRemoteStatus(projectPath));
    }
));

// ─── 提交操作路由 ──────────────────────────────────────

router.post('/initial-commit', gitHandlerWithStatus(
    async (req, res) => {
        const { project } = req.body;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        const result = await createInitialCommit(projectPath);
        res.json({ success: true, ...result, message: 'Initial commit created successfully' });
    },
    formatInitialCommitError
));

router.post('/commit', gitHandler(
    async (req, res) => {
        const { project, message, files } = req.body;
        if (!project || !message || !files || files.length === 0) {
            return res.status(400).json({ error: 'Project name, commit message, and files are required' });
        }
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await commitFiles(projectPath, files, message) });
    }
));

router.post('/generate-commit-message', gitHandler(
    async (req, res) => {
        const { project, files, provider = 'claude' } = req.body;
        if (!project || !files || files.length === 0) return res.status(400).json({ error: 'Project name and files are required' });
        if (!['claude', 'cursor'].includes(provider)) return res.status(400).json({ error: 'provider must be "claude" or "cursor"' });
        const projectPath = await resolveProjectPath(project);
        res.json({ message: await generateCommitMessage(projectPath, files, provider) });
    }
));

// ─── 分支操作路由 ──────────────────────────────────────

router.post('/checkout', gitHandler(
    async (req, res) => {
        const { project, branch } = req.body;
        if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await checkoutBranch(projectPath, branch) });
    }
));

router.post('/create-branch', gitHandler(
    async (req, res) => {
        const { project, branch } = req.body;
        if (!project || !branch) return res.status(400).json({ error: 'Project name and branch name are required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await createBranch(projectPath, branch) });
    }
));

// ─── 远程操作路由 ──────────────────────────────────────

router.post('/fetch', gitHandler(
    async (req, res) => {
        const { project } = req.body;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await fetchFromRemote(projectPath) });
    },
    (error) => ({ error: 'Fetch failed', details: classifyRemoteError(error) })
));

router.post('/pull', gitHandler(
    async (req, res) => {
        const { project } = req.body;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await pullFromRemote(projectPath) });
    },
    (error) => ({ error: classifyPullError(error), details: classifyPullDetails(error) })
));

router.post('/push', gitHandler(
    async (req, res) => {
        const { project } = req.body;
        if (!project) return res.status(400).json({ error: 'Project name is required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await pushToRemote(projectPath) });
    },
    (error) => ({ error: classifyPushError(error), details: classifyPushDetails(error) })
));

router.post('/publish', gitHandler(
    async (req, res) => {
        const { project, branch } = req.body;
        if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
        const projectPath = await resolveProjectPath(project);
        res.json({ success: true, ...await publishBranch(projectPath, branch) });
    },
    (error) => ({ error: classifyPublishError(error), details: classifyPublishDetails(error) })
));

// ─── 文件操作路由 ──────────────────────────────────────

router.post('/discard', gitHandler(
    async (req, res) => {
        const { project, file } = req.body;
        if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
        const projectPath = await resolveProjectPath(project);
        await discardChanges(projectPath, file);
        res.json({ success: true, message: `Changes discarded for ${file}` });
    }
));

router.post('/delete-untracked', gitHandler(
    async (req, res) => {
        const { project, file } = req.body;
        if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
        const projectPath = await resolveProjectPath(project);
        const isDir = await deleteUntracked(projectPath, file);
        res.json({ success: true, message: `Untracked ${isDir ? 'directory' : 'file'} ${file} deleted successfully` });
    }
));

export default router;
