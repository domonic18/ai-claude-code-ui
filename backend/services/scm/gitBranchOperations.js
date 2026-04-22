/**
 * Git Branch Operations
 *
 * Handles branch checkout, creation, and pushing operations.
 * Extracted from GitHubService.js to reduce complexity.
 *
 * @module services/scm/gitBranchOperations
 */

import { createLogger } from '../../utils/logger.js';
import { gitSpawn } from './gitSpawn.js';

const logger = createLogger('services/scm/gitBranchOperations');

// gitBranchOperations.js 功能函数
/**
 * Create and checkout local branch
 * @param {string} projectPath - Project path
 * @param {string} branchName - Branch name
 * @returns {Promise<void>}
 * @throws {Error} If branch creation fails
 */
export async function checkoutBranch(projectPath, branchName) {
  try {
    await gitSpawn(['checkout', '-b', branchName], projectPath);
    logger.info({ branchName }, 'Created and checked out local branch');
    return;
  } catch (error) {
    if (!error.stderr || !error.stderr.includes('already exists')) {
      throw new Error(`Failed to create branch: ${error.stderr || error.message}`);
    }
  }

  // Branch already exists, checkout existing branch
  logger.info({ branchName }, 'Branch already exists locally, checking out');
  try {
    await gitSpawn(['checkout', branchName], projectPath);
    logger.info({ branchName }, 'Checked out existing branch');
  } catch (error) {
    throw new Error(`Failed to checkout existing branch: ${error.stderr || error.message}`);
  }
}

// gitBranchOperations.js 功能函数
/**
 * Push branch to remote (tolerates already exists case)
 * @param {string} projectPath - Project path
 * @param {string} branchName - Branch name
 * @returns {Promise<void>}
 * @throws {Error} If push fails for non-tolerable reasons
 */
export async function pushBranchToRemote(projectPath, branchName) {
  try {
    await gitSpawn(['push', '-u', 'origin', branchName], projectPath);
    logger.info({ branchName }, 'Pushed branch to remote');
  } catch (error) {
    const tolerable = error.stderr && (
      error.stderr.includes('already exists') || error.stderr.includes('up-to-date')
    );
    if (tolerable) {
      logger.info({ branchName }, 'Branch already exists on remote, using existing branch');
    } else {
      throw new Error(`Failed to push branch: ${error.stderr || error.message}`);
    }
  }
}

// gitBranchOperations.js 功能函数
/**
 * Create and push new branch to remote (combined operation)
 * @param {string} projectPath - Project path
 * @param {string} branchName - Branch name
 * @returns {Promise<void>}
 */
export async function createAndPushBranch(projectPath, branchName) {
  await checkoutBranch(projectPath, branchName);
  await pushBranchToRemote(projectPath, branchName);
}

// gitBranchOperations.js 功能函数
/**
 * Create a branch on GitHub via Octokit API
 * @param {Object} octokit - Octokit 实例
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} branchName - 新分支名称
 * @param {string} [baseBranch='main'] - 基础分支
 * @returns {Promise<void>}
 */
export async function createGitHubBranch(octokit, owner, repo, branchName, baseBranch = 'main') {
  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: ref.object.sha });
    logger.info({ branchName, owner, repo }, `Created branch '${branchName}' on GitHub`);
  } catch (error) {
    if (error.status === 422 && error.message.includes('Reference already exists')) {
      logger.info({ branchName, owner, repo }, `Branch '${branchName}' already exists on GitHub`);
    } else {
      throw error;
    }
  }
}
