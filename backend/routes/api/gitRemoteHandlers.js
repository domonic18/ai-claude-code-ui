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

// 定义 HTTP 路由处理器
/**
 * Handle fetch request
 */
export async function handleFetch(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await fetchFromRemote(projectPath) });
}

// 定义 HTTP 路由处理器
/**
 * Handle pull request
 */
export async function handlePull(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await pullFromRemote(projectPath) });
}

// 定义 HTTP 路由处理器
/**
 * Handle push request
 */
export async function handlePush(req, res) {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await pushToRemote(projectPath) });
}

// 定义 HTTP 路由处理器
/**
 * Handle publish branch request
 */
export async function handlePublish(req, res) {
  const { project, branch } = req.body;
  if (!project || !branch) return res.status(400).json({ error: 'Project name and branch are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ success: true, ...await publishBranch(projectPath, branch) });
}

