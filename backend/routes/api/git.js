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

// 定义 HTTP 路由处理器
/**
 * 通用 Git 路由错误处理包装器
 *
 * 捕获路由处理器中的异常，使用可选的 errorFormatter 格式化错误响应。
 * 无格式化器时返回 `{ error: error.message }`。
 *
 * @param {Function} handler - 异步路由处理函数 (req, res) => Promise<void>
 * @param {Function} [errorFormatter] - 可选的错误格式化函数 (error) => object
 * @returns {Function} Express 中间件函数
 */
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

// 定义 HTTP 路由处理器
/**
 * 格式化 git status 错误响应
 * 区分 "不是 git 仓库" 和其他通用错误
 *
 * @param {Error} error - 捕获的错误
 * @returns {{error: string, details: string}}
 */
function formatGitStatusError(error) {
    const isGitRepoError = error.message.includes('not a git repository')
        || error.message.includes('Project directory is not a git repository');
    return {
        error: isGitRepoError ? error.message : 'Git operation failed',
        details: error.message
    };
}

// 定义 HTTP 路由处理器
/**
 * 格式化 initial commit 错误响应
 * 返回含 HTTP 状态码的结构化错误
 *
 * @param {Error} error
 * @returns {{status: number, error: string, details?: string}}
 */
function formatInitialCommitError(error) {
    if (error.message.includes('already has commits')) {
        return { status: 400, error: error.message };
    }
    if (error.message.includes('nothing to commit')) {
        return { status: 400, error: 'Nothing to commit', details: 'No files found in the repository. Add some files first.' };
    }
    return { status: 500, error: error.message };
}

// 定义 HTTP 路由处理器
/**
 * 格式化 file-with-diff 错误响应
 * 目录类型差异查询返回 400，其他返回 500
 *
 * @param {Error} error
 * @returns {{status: number, error: string}}
 */
function formatFileWithDiffError(error) {
    if (error.message.includes('Cannot show diff for directories')) {
        return { status: 400, error: error.message };
    }
    return { status: 500, error: error.message };
}

// 定义 HTTP 路由处理器
/**
 * 带 HTTP 状态码的 Git 路由错误处理包装器
 *
 * 与 gitHandler 类似，但错误格式化器需返回含 `status` 字段的对象，
 * 用于设置响应的 HTTP 状态码。
 *
 * @param {Function} handler - 异步路由处理函数
 * @param {Function} statusErrorFormatter - 错误格式化函数，返回 {status: number, error: string, ...}
 * @returns {Function} Express 中间件函数
 */
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

