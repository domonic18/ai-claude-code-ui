/**
 * Git Workflow Executor
 *
 * Executes complete GitHub workflows (clone, branch, PR creation).
 * Extracted from GitHubService.js to reduce complexity.
 *
 * @module services/scm/gitWorkflowExecutor
 */

import path from 'path';
import { promises as fs } from 'fs';
import { Octokit } from '@octokit/rest';
import { createLogger } from '../../utils/logger.js';
import { gitSpawn } from './gitSpawn.js';
import { buildCloneAuth } from './GitAuthHelper.js';
import { normalizeGitHubUrl, parseGitHubUrl } from './GitHubService.js';
import { createAndPushBranch } from './gitBranchOperations.js';

const logger = createLogger('services/scm/gitWorkflowExecutor');

// gitWorkflowExecutor.js 功能函数
/**
 * Check if target directory already contains the correct repository
 * @param {string} cloneDir - Target directory
 * @param {string} githubUrl - Expected GitHub URL
 * @returns {Promise<string|null>} Path if directory exists and matches, null otherwise
 * @throws {Error} If directory exists with different repository
 */
async function checkExistingRepo(cloneDir, githubUrl) {
  try {
    await fs.access(cloneDir);
  } catch {
    return null; // Directory doesn't exist
  }

  // Directory exists, check repository URL
  try {
    const { stdout } = await gitSpawn(['config', '--get', 'remote.origin.url'], cloneDir);
    const existingUrl = stdout.trim();

    if (normalizeGitHubUrl(existingUrl) === normalizeGitHubUrl(githubUrl)) {
      logger.info({ cloneDir, githubUrl }, 'Repository already exists at path with correct URL');
      return cloneDir;
    }

    throw new Error(`Directory ${cloneDir} already exists with a different repository (${existingUrl}). Expected: ${githubUrl}`);
  } catch (gitError) {
    if (gitError.message.includes('already exists with a different repository')) {
      throw gitError;
    }
    throw new Error(`Directory ${cloneDir} already exists but is not a valid git repository`);
  }
}

// gitWorkflowExecutor.js 功能函数
/**
 * Perform git clone operation (unified path with and without token)
 * @param {string} githubUrl - GitHub repository URL
 * @param {string} cloneDir - Target directory
 * @param {string|null} githubToken - GitHub token
 * @returns {Promise<void>}
 * @throws {Error} If clone fails
 */
async function performClone(githubUrl, cloneDir, githubToken) {
  const { env, cleanup } = await buildCloneAuth(githubToken);

  try {
    await gitSpawn(['clone', '--depth', '1', githubUrl, cloneDir], process.cwd(), {
      env,
      timeout: 60000,
    });
    logger.info({ cloneDir, githubUrl }, 'Repository cloned successfully');
  } catch (error) {
    logger.error({ error: error.message, githubUrl, cloneDir }, 'Git clone failed');
    throw new Error(`Git clone failed: ${error.message}`);
  } finally {
    await cleanup();
  }
}

// gitWorkflowExecutor.js 功能函数
/**
 * Clone GitHub repository to specified directory
 * @param {string} githubUrl - GitHub repository URL
 * @param {string|null} githubToken - GitHub token (optional, for private repos)
 * @param {string} projectPath - Clone target path
 * @returns {Promise<string>} Cloned path
 */
export async function cloneGitHubRepo(githubUrl, githubToken = null, projectPath) {
  if (!githubUrl || !githubUrl.includes('github.com')) {
    throw new Error('Invalid GitHub URL');
  }

  const cloneDir = path.resolve(projectPath);

  // Check if directory already exists
  const existing = await checkExistingRepo(cloneDir, githubUrl);
  if (existing) return existing;

  await fs.mkdir(path.dirname(cloneDir), { recursive: true });
  logger.info({ githubUrl, cloneDir }, 'Cloning repository');

  await performClone(githubUrl, cloneDir, githubToken);
  return cloneDir;
}

// gitWorkflowExecutor.js 功能函数
/**
 * Get git repository remote URL
 * @param {string} repoPath - Git repository path
 * @returns {Promise<string>} Remote URL
 */
export async function getGitRemoteUrl(repoPath) {
  const { stdout } = await gitSpawn(['config', '--get', 'remote.origin.url'], repoPath);
  return stdout.trim();
}

// gitWorkflowExecutor.js 功能函数
/**
 * Get commit messages from repository
 * @param {string} projectPath - Git repository path
 * @param {number} [limit=5] - Number of commits
 * @returns {Promise<string[]>} Array of commit messages
 */
export async function getCommitMessages(projectPath, limit = 5) {
  const { stdout } = await gitSpawn(['log', `-${limit}`, '--pretty=format:%s'], projectPath);
  return stdout.trim().split('\n').filter(msg => msg.length > 0);
}

// gitWorkflowExecutor.js 功能函数
/**
 * Create GitHub Pull Request
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branchName - Head branch name
 * @param {string} title - PR title
 * @param {string} body - PR body
 * @param {string} [baseBranch='main'] - Base branch
 * @returns {Promise<{number: number, url: string}>} PR number and URL
 */
export async function createGitHubPR(octokit, owner, repo, branchName, title, body, baseBranch = 'main') {
  const { data: pr } = await octokit.pulls.create({
    owner, repo, title, head: branchName, base: baseBranch, body
  });

  logger.info({ prNumber: pr.number, url: pr.html_url, owner, repo, branchName, title },
    `Created pull request #${pr.number}: ${pr.html_url}`);

  return { number: pr.number, url: pr.html_url };
}

// gitWorkflowExecutor.js 功能函数
/**
 * Execute complete GitHub branch + PR workflow
 * @param {Object} params - Workflow parameters
 * @param {string} params.githubUrl - GitHub repository URL
 * @param {string} params.projectPath - Local project path
 * @param {string} params.branchName - Branch name
 * @param {boolean} params.createBranch - Whether to create branch
 * @param {boolean} params.createPR - Whether to create PR
 * @param {string} params.githubToken - GitHub token
 * @param {string} params.message - Agent message (for PR description fallback)
 * @returns {Promise<{branchInfo: Object|null, prInfo: Object|null}>}
 */
export async function executeGitHubWorkflow(params) {
  const { githubUrl, projectPath, branchName, createBranch, createPR, githubToken, message } = params;

  const octokit = new Octokit({ auth: githubToken });

  // Get repository URL
  let repoUrl = githubUrl;
  if (!repoUrl) {
    repoUrl = await getGitRemoteUrl(projectPath);
    if (!repoUrl.includes('github.com')) {
      throw new Error('Project does not have a GitHub remote configured');
    }
  }

  const { owner, repo } = parseGitHubUrl(repoUrl);
  logger.info({ owner, repo }, 'Repository info');

  let branchInfo = null;
  let prInfo = null;

  if (createBranch) {
    await createAndPushBranch(projectPath, branchName);

    branchInfo = {
      name: branchName,
      url: `https://github.com/${owner}/${repo}/tree/${branchName}`
    };
  }

  if (createPR) {
    const commitMessages = await getCommitMessages(projectPath, 5);
    const prTitle = commitMessages.length > 0 ? commitMessages[0] : message;

    let prBody = '## Changes\n\n';
    prBody += commitMessages.length > 0
      ? commitMessages.map(msg => `- ${msg}`).join('\n')
      : `Agent task: ${message}`;
    prBody += '\n\n---\n*This pull request was automatically created by Claude Code UI Agent.*';

    prInfo = await createGitHubPR(octokit, owner, repo, branchName, prTitle, prBody, 'main');
  }

  return { branchInfo, prInfo };
}
