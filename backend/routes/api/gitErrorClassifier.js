/**
 * Git Error Classifier
 * ===================
 *
 * Git 错误分类与消息优化系统。
 * 提供统一的错误分类规则、操作模式匹配和快捷包装函数。
 *
 * @module routes/api/gitErrorClassifier
 */

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

/** 快捷包装函数 - Remote 操作错误分类 */
function classifyRemoteError(error) {
    return classifyGitError(error, 'remote', 'error');
}

/** 快捷包装函数 - Pull 操作错误分类 */
function classifyPullError(error) {
    return classifyGitError(error, 'pull', 'error');
}

/** 快捷包装函数 - Pull 操作详细信息分类 */
function classifyPullDetails(error) {
    return classifyGitError(error, 'pull', 'detail');
}

/** 快捷包装函数 - Push 操作错误分类 */
function classifyPushError(error) {
    return classifyGitError(error, 'push', 'error');
}

/** 快捷包装函数 - Push 操作详细信息分类 */
function classifyPushDetails(error) {
    return classifyGitError(error, 'push', 'detail');
}

/** 快捷包装函数 - Publish 操作错误分类 */
function classifyPublishError(error) {
    return classifyGitError(error, 'publish', 'error');
}

/** 快捷包装函数 - Publish 操作详细信息分类 */
function classifyPublishDetails(error) {
    return classifyGitError(error, 'publish', 'detail');
}

export {
    GIT_ERROR_RULES,
    OPERATION_PATTERNS,
    PUBLISH_DETAIL_OVERRIDES,
    classifyGitError,
    classifyRemoteError,
    classifyPullError,
    classifyPullDetails,
    classifyPushError,
    classifyPushDetails,
    classifyPublishError,
    classifyPublishDetails,
};
