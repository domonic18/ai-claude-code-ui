/**
 * gitRemoteHandlers.js
 *
 * Git remote operation route handlers
 *
 * @module routes/api/gitRemoteHandlers
 */

import {
  resolveProjectPath,
  fetchFromRemote,
  pullFromRemote,
  pushToRemote,
  publishBranch
} from '../../services/scm/index.js';

/**
 * Handle fetch request
 */
export async function handleFetch(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await fetchFromRemote(projectPath) });
}

/**
 * Handle pull request
 */
export async function handlePull(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await pullFromRemote(projectPath) });
}

/**
 * Handle push request
 */
export async function handlePush(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await pushToRemote(projectPath) });
}

/**
 * Handle publish branch request
 */
export async function handlePublish(req, res) {
  const { project, branch } = req.body;
  if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await publishBranch(projectPath, branch) });
}
