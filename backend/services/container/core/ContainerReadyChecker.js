/**
 * Container Ready Checker
 *
 * Handles container readiness checks and waiting logic.
 * Extracted from ContainerLifecycle.js to reduce complexity.
 *
 * @module services/container/core/ContainerReadyChecker
 */

import { ContainerStateMachine, ContainerState } from './ContainerStateMachine.js';
import { CONTAINER_TIMEOUTS } from '../../../config/config.js';

/**
 * Wait for container to reach ready state
 * @param {ContainerStateMachine} stateMachine - State machine instance
 * @returns {Promise<ContainerStateMachine>} State machine in ready state
 * @throws {Error} If container fails or times out
 */
export async function waitForReady(stateMachine) {
  if (stateMachine.is(ContainerState.READY)) {
    return stateMachine;
  }

  if (stateMachine.is(ContainerState.FAILED)) {
    const error = stateMachine.getError()?.message || 'Unknown error';
    throw new Error(`Container is in failed state: ${error}`);
  }

  await stateMachine.waitForStable({ timeout: CONTAINER_TIMEOUTS.ready });

  if (stateMachine.is(ContainerState.READY)) {
    return stateMachine;
  }

  if (stateMachine.is(ContainerState.FAILED)) {
    const error = stateMachine.getError()?.message || 'Unknown error';
    throw new Error(`Container creation failed: ${error}`);
  }

  throw new Error(`Container not ready, current state: ${stateMachine.getState()}`);
}

/**
 * Handle intermediate state when container is being created
 * @param {string} userId - User ID
 * @param {Object} userConfig - User configuration
 * @param {Object} options - Options object with wait flag
 * @param {ContainerStateMachine} stateMachine - State machine instance
 * @param {Function} waitForReadyFn - Function to wait for ready state
 * @returns {Promise<Object>} Container info
 */
export async function handleIntermediateState(userId, userConfig, options, stateMachine, waitForReadyFn) {
  if (options.wait === false) {
    throw new Error(`Container is ${stateMachine.getState()}, not ready yet`);
  }

  try {
    await waitForReadyFn(stateMachine);
    return { ready: true };
  } catch (error) {
    if (stateMachine.is(ContainerState.FAILED)) {
      stateMachine.transitionTo(ContainerState.NON_EXISTENT);
      await containerStateStore.save(stateMachine);
      // Return indication to retry
      return { ready: false, retry: true };
    }
    throw error;
  }
}
