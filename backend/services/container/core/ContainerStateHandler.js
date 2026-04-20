/**
 * Container State Handler
 *
 * Handles intermediate state validation and management for container lifecycle
 * Extracted from ContainerLifecycle.js to reduce complexity.
 *
 * @module container/core/ContainerStateHandler
 */

import { ContainerState } from './ContainerStateMachine.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerStateHandler');

const STALE_STATE_THRESHOLD_MS = 30000;
const INTERMEDIATE_STATES = [ContainerState.CREATING, ContainerState.STARTING, ContainerState.HEALTH_CHECKING];

/**
 * Handle intermediate state (creating, starting, health_checking)
 * @param {number} userId - User ID
 * @param {Object} userConfig - User configuration
 * @param {Object} options - Options object
 * @param {Object} stateMachine - State machine instance
 * @param {Function} getOrCreateContainer - Function to get or create container
 * @returns {Promise<Object>} Container info
 */
export async function handleIntermediateState(userId, userConfig, options, stateMachine, getOrCreateContainer) {
  if (options.wait === false) {
    throw new Error(`Container is ${stateMachine.getState()}, not ready yet`);
  }

  try {
    const { waitForReady } = await import('./ContainerReadyChecker.js');
    await waitForReady(stateMachine);
    // State is now READY — recurse to get the actual container info from the READY branch
    return getOrCreateContainer(userId, userConfig, options);
  } catch (error) {
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      const { containerStateStore } = await import('./ContainerStateStore.js');
      await containerStateStore.save(stateMachine);
      return getOrCreateContainer(userId, userConfig, options);
    }
    throw error;
  }
}

/**
 * Validate intermediate state and reset if stale
 * @param {Object} sm - State machine instance
 * @param {string} containerName - Container name
 * @param {Function} verifyContainerExists - Function to verify container exists
 * @returns {Promise<void>}
 */
export async function validateIntermediateState(sm, containerName, verifyContainerExists) {
  if (!INTERMEDIATE_STATES.includes(sm.getState())) return;

  const exists = await verifyContainerExists(containerName);
  if (exists) return;

  const stateAge = Date.now() - sm.lastTransitionTime.getTime();
  if (stateAge > STALE_STATE_THRESHOLD_MS) {
    logger.info(`Container ${containerName} not found, state is ${sm.getState()} for ${Math.floor(stateAge / 1000)}s, force resetting`);
    sm.forceReset();
    const { containerStateStore } = await import('./ContainerStateStore.js');
    await containerStateStore.save(sm);
  } else {
    logger.info(`Container ${containerName} not found but state ${sm.getState()} is recent, not resetting`);
  }
}
