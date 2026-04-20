/**
 * gitWriteHandlers.js
 *
 * Git write operation route handlers
 *
 * @module routes/api/gitWriteHandlers
 */

import {
  resolveProjectPath,
  createInitialCommit,
  commitFiles,
  generateCommitMessage,
  checkoutBranch,
  createBranch,
  discardChanges,
  deleteUntracked
} from '../../services/scm/index.js';

/**
 * Handle initial commit request
 */
export async function handleInitialCommit(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  const result = await createInitialCommit(projectPath);
  res.json({ success: true, ...result, message: 'Initial commit created successfully' });
}

/**
 * Handle commit request
 */
export async function handleCommit(req, res) {
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
export async function handleGenerateCommitMessage(req, res) {
  const { project, files, provider = 'claude' } = req.body;
  if (!project || !files || files.length === 0) return res.status(400).json({ error: 'Project name and files are required' });
  if (!['claude', 'cursor'].includes(provider)) return res.status(400).json({ error: 'provider must be "claude" or "cursor"' });
  const projectPath = await resolveProjectPath(project);
  res.json({ message: await generateCommitMessage(projectPath, files, provider) });
}

/**
 * Handle checkout request
 */
export async function handleCheckout(req, res) {
  const { project, branch } = req.body;
  if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await checkoutBranch(projectPath, branch) });
}

/**
 * Handle create branch request
 */
export async function handleCreateBranch(req, res) {
  const { project, branch } = req.body;
  if (!project || !branch) return res.status(400).json({ error: 'Project name and branch name are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await createBranch(projectPath, branch) });
}

/**
 * Handle discard changes request
 */
export async function handleDiscard(req, res) {
  const { project, file } = req.body;
  if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
  const projectPath = await resolveProjectPath(project);
  await discardChanges(projectPath, file);
  res.json({ success: true, message: `Changes discarded for ${file}` });
}

/**
 * Handle delete untracked request
 */
export async function handleDeleteUntracked(req, res) {
  const { project, file } = req.body;
  if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
  const projectPath = await resolveProjectPath(project);
  const isDir = await deleteUntracked(projectPath, file);
  res.json({ success: true, message: `Untracked ${isDir ? 'directory' : 'file'} ${file} deleted successfully` });
}
