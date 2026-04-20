/**
 * Git Route Handlers
 *
 * Business logic handlers for Git API routes.
 * Each handler validates parameters and calls GitService operations.
 *
 * @module routes/api/gitRouteHandlers
 */

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

/**
 * Handle git status request
 */
async function handleGetStatus(req, res) {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json(await getStatus(projectPath));
}

/**
 * Handle git diff request
 */
async function handleGetDiff(req, res) {
    const { project, file } = req.query;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ diff: await getFileDiff(projectPath, file) });
}

/**
 * Handle file with diff request
 */
async function handleGetFileWithDiff(req, res) {
    const { project, file } = req.query;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
    const projectPath = await resolveProjectPath(project);
    res.json(await getFileWithDiff(projectPath, file));
}

/**
 * Handle branches request
 */
async function handleGetBranches(req, res) {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ branches: await getBranches(projectPath) });
}

/**
 * Handle commits request
 */
async function handleGetCommits(req, res) {
    const { project, limit = 10 } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 500);
    const projectPath = await resolveProjectPath(project);
    res.json({ commits: await getCommits(projectPath, safeLimit) });
}

/**
 * Handle commit diff request
 */
async function handleGetCommitDiff(req, res) {
    const { project, commit } = req.query;
    if (!project || !commit) return res.status(400).json({ error: 'Project name and commit hash are required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ diff: await getCommitDiff(projectPath, commit) });
}

/**
 * Handle remote status request
 */
async function handleGetRemoteStatus(req, res) {
    const { project } = req.query;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json(await getRemoteStatus(projectPath));
}

/**
 * Handle initial commit request
 */
async function handleInitialCommit(req, res) {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    const result = await createInitialCommit(projectPath);
    res.json({ success: true, ...result, message: 'Initial commit created successfully' });
}

/**
 * Handle commit request
 */
async function handleCommit(req, res) {
    const { project, message, files } = req.body;
    if (!project || !message || !files || files.length === 0) {
        return res.status(400).json({ error: 'Project name, commit message, and files are required' });
    }
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await commitFiles(projectPath, files, message) });
}

/**
 * Handle generate commit message request
 */
async function handleGenerateCommitMessage(req, res) {
    const { project, files, provider = 'claude' } = req.body;
    if (!project || !files || files.length === 0) return res.status(400).json({ error: 'Project name and files are required' });
    if (!['claude', 'cursor'].includes(provider)) return res.status(400).json({ error: 'provider must be "claude" or "cursor"' });
    const projectPath = await resolveProjectPath(project);
    res.json({ message: await generateCommitMessage(projectPath, files, provider) });
}

/**
 * Handle checkout request
 */
async function handleCheckout(req, res) {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await checkoutBranch(projectPath, branch) });
}

/**
 * Handle create branch request
 */
async function handleCreateBranch(req, res) {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch name are required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await createBranch(projectPath, branch) });
}

/**
 * Handle fetch request
 */
async function handleFetch(req, res) {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await fetchFromRemote(projectPath) });
}

/**
 * Handle pull request
 */
async function handlePull(req, res) {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await pullFromRemote(projectPath) });
}

/**
 * Handle push request
 */
async function handlePush(req, res) {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: 'Project name is required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await pushToRemote(projectPath) });
}

/**
 * Handle publish branch request
 */
async function handlePublish(req, res) {
    const { project, branch } = req.body;
    if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
    const projectPath = await resolveProjectPath(project);
    res.json({ success: true, ...await publishBranch(projectPath, branch) });
}

/**
 * Handle discard changes request
 */
async function handleDiscard(req, res) {
    const { project, file } = req.body;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
    const projectPath = await resolveProjectPath(project);
    await discardChanges(projectPath, file);
    res.json({ success: true, message: `Changes discarded for ${file}` });
}

/**
 * Handle delete untracked request
 */
async function handleDeleteUntracked(req, res) {
    const { project, file } = req.body;
    if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
    const projectPath = await resolveProjectPath(project);
    const isDir = await deleteUntracked(projectPath, file);
    res.json({ success: true, message: `Untracked ${isDir ? 'directory' : 'file'} ${file} deleted successfully` });
}

export {
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
};
