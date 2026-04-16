/**
 * Workspace Service
 *
 * Business logic for workspace creation and management.
 * Handles container operations, git initialization, and GitHub cloning.
 *
 * @module services/workspace/WorkspaceService
 */

import { CONTAINER } from '../../config/config.js';
import containerManager from '../../services/container/core/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/workspace/WorkspaceService');

/**
 * Execute a command in the container and wait for it to complete
 * @param {string} userId - User identifier
 * @param {string[]} command - Command to execute
 * @param {object} [options] - Execution options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execAndWait(userId, command, options = {}) {
  const { timeout = 30000 } = options;
  const { stream } = await containerManager.execInContainer(userId, command);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let stdout = '';
    let stderr = '';

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        resolve({ stdout, stderr });
      }
    };

    if (stream.stdout) {
      stream.stdout.on('data', (d) => stdout += d.toString());
    }
    if (stream.stderr) {
      stream.stderr.on('data', (d) => stderr += d.toString());
    }

    stream.on('end', cleanup);
    stream.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        cleanup();
      }
    }, timeout);
  });
}

/**
 * Clone a GitHub repository into a container path
 * @param {string} userId - User identifier
 * @param {string} githubUrl - Repository URL
 * @param {string} containerPath - Target path in container
 * @param {object} [auth] - Authentication options
 * @param {string} [auth.token] - OAuth token
 * @param {string} [auth.tokenId] - Stored token ID
 * @returns {Promise<void>}
 */
async function cloneRepository(userId, githubUrl, containerPath, auth = {}) {
  let cloneCommand = 'git clone';

  if (auth.token) {
    const parsedUrl = new URL(githubUrl);
    parsedUrl.username = 'oauth2';
    parsedUrl.password = auth.token;
    cloneCommand += ` ${parsedUrl.toString()} "${containerPath}/temp-repo"`;
  } else {
    cloneCommand += ` ${githubUrl} "${containerPath}/temp-repo"`;
  }

  await execAndWait(userId, cloneCommand);

  // Move files to target location
  await execAndWait(userId, ['sh', '-c', 'mv "$1"/temp-repo/.* "$1/" 2>/dev/null || true', 'mvDotfiles', containerPath]);
  await execAndWait(userId, ['sh', '-c', 'mv "$1"/temp-repo/* "$1/" 2>/dev/null || true', 'mvFiles', containerPath]);
  await execAndWait(userId, ['rm', '-rf', `${containerPath}/temp-repo`]);
}

/**
 * Build project info object for API response
 * @param {string} projectName - Normalized project name
 * @param {string} cleanPath - Original path
 * @returns {object}
 */
function buildProjectInfo(projectName, cleanPath) {
  return {
    name: projectName,
    path: cleanPath,
    displayName: projectName,
    fullPath: projectName,
    isContainerProject: true,
    sessions: [],
    sessionMeta: { hasMore: false, total: 0 },
    cursorSessions: [],
    codexSessions: []
  };
}

/**
 * Create a new workspace in the container
 * @param {string} userId - User identifier
 * @param {object} params - Creation parameters
 * @param {string} params.workspacePath - Workspace path/name
 * @param {string} [params.githubUrl] - GitHub repository URL
 * @param {string} [params.githubTokenId] - Stored token ID
 * @param {string} [params.newGithubToken] - One-time GitHub token
 * @returns {Promise<object>} Created project info
 */
export async function createNewWorkspace(userId, params) {
  const { workspacePath, githubUrl, githubTokenId, newGithubToken } = params;

  await containerManager.getOrCreateContainer(userId);

  const projectName = workspacePath.replace(/\//g, '-');
  const containerPath = `${CONTAINER.paths.workspace}/${projectName}`;

  try {
    // Create directory
    await containerManager.execInContainer(userId, ['mkdir', '-p', containerPath]);

    // Initialize git repository
    await containerManager.execInContainer(userId, ['sh', '-c', 'cd "$1" && git init', 'gitInit', containerPath]);

    // Clone repository if GitHub URL provided
    if (githubUrl) {
      await cloneRepository(userId, githubUrl, containerPath, {
        token: newGithubToken,
        tokenId: githubTokenId,
      });
    }

    return buildProjectInfo(projectName, workspacePath);
  } catch (error) {
    // Clean up failed creation
    try {
      await containerManager.execInContainer(userId, ['rm', '-rf', containerPath]);
    } catch (cleanupError) {
      logger.error('Failed to clean up workspace:', cleanupError);
    }
    throw new Error(`Failed to create workspace: ${error.message}`);
  }
}

/**
 * Add an existing workspace from the container
 * @param {string} userId - User identifier
 * @param {string} workspacePath - Workspace path/name
 * @returns {Promise<object>} Project info for the existing workspace
 * @throws {Error} If workspace path does not exist in container
 */
export async function addExistingWorkspace(userId, workspacePath) {
  await containerManager.getOrCreateContainer(userId);

  const projectName = workspacePath.replace(/\//g, '-');
  const containerPath = `${CONTAINER.paths.workspace}/${projectName}`;

  // Check path exists
  const { stdout } = await execAndWait(userId, ['sh', '-c', 'ls -la "$1" 2>/dev/null || echo "NOT_FOUND"', 'lsCheck', containerPath]);

  if (stdout.includes('NOT_FOUND')) {
    throw new Error('Workspace path does not exist in container');
  }

  return buildProjectInfo(projectName, workspacePath);
}

/**
 * Delete a project directory from the container
 * @param {string} userId - User identifier
 * @param {string} projectName - Project name to delete
 * @returns {Promise<void>}
 */
export async function deleteWorkspace(userId, projectName) {
  const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;
  await execAndWait(userId, ['rm', '-rf', projectPath]);
}
