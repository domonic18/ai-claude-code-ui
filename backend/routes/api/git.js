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
import {
    handleGetStatus,
    handleGetDiff,
    handleGetFileWithDiff,
    handleGetBranches,
    handleGetCommits,
    handleGetCommitDiff,
    handleGetRemoteStatus,
    handleInitialCommit,
    handleCommit,
    handleGenerateCommitMessage,
    handleCheckout,
    handleCreateBranch,
    handleFetch,
    handlePull,
    handlePush,
    handlePublish,
    handleDiscard,
    handleDeleteUntracked
} from './gitRouteHandlers.js';

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

router.get('/status', gitHandler(handleGetStatus, formatGitStatusError));
router.get('/diff', gitHandler(handleGetDiff));
router.get('/file-with-diff', gitHandlerWithStatus(handleGetFileWithDiff, formatFileWithDiffError));
router.get('/branches', gitHandler(handleGetBranches));
router.get('/commits', gitHandler(handleGetCommits));
router.get('/commit-diff', gitHandler(handleGetCommitDiff));
router.get('/remote-status', gitHandler(handleGetRemoteStatus));

// ─── 提交操作路由 ──────────────────────────────────────

router.post('/initial-commit', gitHandlerWithStatus(handleInitialCommit, formatInitialCommitError));
router.post('/commit', gitHandler(handleCommit));
router.post('/generate-commit-message', gitHandler(handleGenerateCommitMessage));

// ─── 分支操作路由 ──────────────────────────────────────

router.post('/checkout', gitHandler(handleCheckout));
router.post('/create-branch', gitHandler(handleCreateBranch));

// ─── 远程操作路由 ──────────────────────────────────────

router.post('/fetch', gitHandler(handleFetch, (error) => ({ error: 'Fetch failed', details: classifyRemoteError(error) })));
router.post('/pull', gitHandler(handlePull, (error) => ({ error: classifyPullError(error), details: classifyPullDetails(error) })));
router.post('/push', gitHandler(handlePush, (error) => ({ error: classifyPushError(error), details: classifyPushDetails(error) })));
router.post('/publish', gitHandler(handlePublish, (error) => ({ error: classifyPublishError(error), details: classifyPublishDetails(error) })));

// ─── 文件操作路由 ──────────────────────────────────────

router.post('/discard', gitHandler(handleDiscard));
router.post('/delete-untracked', gitHandler(handleDeleteUntracked));

export default router;
