/**
 * gitReadHandlers.js
 *
 * Git read operation route handlers
 *
 * @module routes/api/gitReadHandlers
 */

import {
  resolveProjectPath,
  getStatus,
  getFileDiff,
  getFileWithDiff,
  getCommits,
  getCommitDiff,
  getRemoteStatus,
  getBranches
} from '../../services/scm/index.js';

// 定义 HTTP 路由处理器
/**
 * Handle git status request
 */
export async function handleGetStatus(req, res) {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json(await getStatus(projectPath));
}

// 定义 HTTP 路由处理器
/**
 * Handle git diff request
 */
export async function handleGetDiff(req, res) {
  const { project, file } = req.query;
  if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ diff: await getFileDiff(projectPath, file) });
}

// 定义 HTTP 路由处理器
/**
 * Handle file with diff request
 */
export async function handleGetFileWithDiff(req, res) {
  const { project, file } = req.query;
  if (!project || !file) return res.status(400).json({ error: 'Project name and file path are required' });
  const projectPath = await resolveProjectPath(project);
  res.json(await getFileWithDiff(projectPath, file));
}

// 定义 HTTP 路由处理器
/**
 * Handle branches request
 */
export async function handleGetBranches(req, res) {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ branches: await getBranches(projectPath) });
}

// 定义 HTTP 路由处理器
/**
 * Handle commits request
 */
export async function handleGetCommits(req, res) {
  const { project, limit = 10 } = req.query;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 500);
  const projectPath = await resolveProjectPath(project);
  res.json({ commits: await getCommits(projectPath, safeLimit) });
}

// 定义 HTTP 路由处理器
/**
 * Handle commit diff request
 */
export async function handleGetCommitDiff(req, res) {
  const { project, commit } = req.query;
  if (!project || !commit) return res.status(400).json({ error: 'Project name and commit hash are required' });
  const projectPath = await resolveProjectPath(project);
  res.json({ diff: await getCommitDiff(projectPath, commit) });
}

// 定义 HTTP 路由处理器
/**
 * Handle remote status request
 */
export async function handleGetRemoteStatus(req, res) {
  const { project } = req.query;
  if (!project) return res.status(400).json({ error: 'Project name is required' });
  const projectPath = await resolveProjectPath(project);
  res.json(await getRemoteStatus(projectPath));
}

