/**
 * SCM（源代码管理）模块统一导出
 */

export {
    resolveProjectPath,
    validateRepository,
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
    generateCommitMessage,
    stripDiffHeaders,
    cleanCommitMessage
} from './GitService.js';

export {
    normalizeGitHubUrl,
    parseGitHubUrl,
    autogenerateBranchName,
    validateBranchName,
    getGitRemoteUrl,
    getCommitMessages,
    cloneGitHubRepo,
    createAndPushBranch,
    createGitHubBranch,
    createGitHubPR,
    executeGitHubWorkflow,
    cleanupProject
} from './GitHubService.js';
