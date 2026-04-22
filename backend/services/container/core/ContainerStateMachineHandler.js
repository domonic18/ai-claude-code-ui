/**
 * Container State Machine Handler
 *
 * Manages state machine creation and lifecycle for containers
 * Extracted from ContainerLifecycle.js to reduce complexity.
 *
 * @module container/core/ContainerStateMachineHandler
 */

import path from 'path';
import { repositories } from '../../../database/db.js';
import { getWorkspaceDir, CONTAINER } from '../../../config/config.js';
import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import containerStateStore from './ContainerStateStore.js';
import { syncExtensions } from '../../extensions/extension-sync.js';
import * as ContainerOps from './ContainerOperations.js';
import * as ContainerSetup from './ContainerSetup.js';
import { waitForReady } from './ContainerReadyChecker.js';
import { saveContainerToDb } from './ContainerLifecycleHelpers.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerStateMachineHandler');

// 在容器创建期间编排状态机转换
/**
 * Create container with state machine workflow
 * @param {Object} docker - Dockerode instance
 * @param {number} userId - User ID
 * @param {Object} userConfig - User configuration
 * @param {Object} stateMachine - State machine instance
 * @param {Map} containers - Containers registry
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Container info
 */
export async function createContainerWithStateMachine(docker, userId, userConfig, stateMachine, containers, config) {
  stateMachine.beginCreation();
  try {
    // Step 1: CREATING
    stateMachine.transitionTo(ContainerState.CREATING);
    await containerStateStore.save(stateMachine);
    const containerInfo = await doCreateContainer(docker, userId, userConfig, config);
    containers.set(userId, containerInfo);

    // Step 2: STARTING
    stateMachine.transitionTo(ContainerState.STARTING);
    await containerStateStore.save(stateMachine);

    // Step 3: HEALTH_CHECKING → READY
    stateMachine.transitionTo(ContainerState.HEALTH_CHECKING);
    await containerStateStore.save(stateMachine);

    const { ContainerHealthMonitor } = await import('./ContainerHealth.js');
    const healthMonitor = new ContainerHealthMonitor(docker);
    await healthMonitor.waitForContainerReady(containerInfo.id);

    stateMachine.transitionTo(ContainerState.READY);
    await containerStateStore.save(stateMachine);
    logger.info(`Container claude-user-${userId} is ready`);
    return containerInfo;
  } catch (error) {
    logger.error(`Container creation failed for user ${userId}:`, error);
    stateMachine.endCreation();
    stateMachine.setFailed(error);
    await containerStateStore.save(stateMachine);
    throw new Error(`Failed to create container for user ${userId}: ${error.message}`);
  } finally {
    const { INTERMEDIATE_STATES } = await import('./ContainerStateHandler.js');
    if (!INTERMEDIATE_STATES.includes(stateMachine.getState())) {
      stateMachine.endCreation();
    }
  }
}

/**
 * Perform actual container creation
 * @param {Object} docker - Dockerode instance
 * @param {number} userId - User ID
 * @param {Object} userConfig - User configuration
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Container info
 */
async function doCreateContainer(docker, userId, userConfig, config) {
  const containerName = `claude-user-${userId}`;
  const userDataDir = path.join(config.dataDir, 'users', `user_${userId}`, 'data');

  // Sync extensions to user directory
  await syncUserExtensions(userDataDir);

  // Create and start container
  const container = await ContainerOps.createAndStartContainer(docker, {
    containerName, userDataDir, userId, userConfig, image: config.image, network: config.network,
  });

  // Initialize container environment
  await runSetup(container);

  const containerInfo = {
    id: container.id,
    name: containerName,
    userId,
    status: 'running',
    createdAt: new Date(),
    lastActive: new Date()
  };
  saveContainerToDb(repositories.Container, userId, containerInfo);
  return containerInfo;
}

/**
 * Sync user extensions (ignore errors)
 * @param {string} userDataDir - User data directory
 */
async function syncUserExtensions(userDataDir) {
  try {
    const claudeDir = path.join(userDataDir, '.claude');
    await syncExtensions(claudeDir, { overwriteUserFiles: true });
  } catch (e) {
    logger.warn(`Failed to sync extensions:`, e.message);
  }
}

/**
 * Run container setup
 * @param {Object} container - Container object
 */
async function runSetup(container) {
  await ensureWorkspaceWithRetry(container);
  await syncContainerExtensions(container);
  await createContainerReadme(container);
}

/**
 * Ensure default workspace (retry 3 times)
 * @param {Object} container - Container object
 */
async function ensureWorkspaceWithRetry(container) {
  for (let i = 0; i < 3; i++) {
    try {
      await ContainerSetup.ensureDefaultWorkspace(container);
      return;
    } catch (e) {
      logger.warn(`Workspace ensure attempt ${i + 1} failed: ${e.message}`);
      if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
}

/**
 * Sync extensions to container (ignore errors)
 * @param {Object} container - Container object
 */
async function syncContainerExtensions(container) {
  try {
    await ContainerSetup.syncExtensionsToContainer(container);
  } catch (e) {
    logger.warn(`Failed to sync extensions:`, e.message);
  }
}

/**
 * Create README in container (ignore errors)
 * @param {Object} container - Container object
 */
async function createContainerReadme(container) {
  try {
    await ContainerSetup.createReadmeInContainer(container);
  } catch (e) {
    logger.warn(`Failed to create README:`, e.message);
  }
}
