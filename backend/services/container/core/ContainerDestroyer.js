/**
 * Container Destroyer
 *
 * Handles container destruction and cleanup operations.
 * Extracted from ContainerLifecycle.js to reduce complexity.
 *
 * @module services/container/core/ContainerDestroyer
 */

import * as ContainerOps from './ContainerOperations.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerDestroyer');

// 当转换到已销毁状态时由 ContainerLifecycle 调用
/**
 * Destroy container and clean up resources
 * @param {Object} docker - Docker client
 * @param {Map} containersMap - Containers map
 * @param {Object} Container - Container model
 * @param {string} userId - User ID
 * @param {boolean} removeVolume - Whether to remove volume
 * @param {string} dataDir - Data directory path
 * @returns {Promise<void>}
 * @throws {Error} If destruction fails
 */
export async function destroyContainer(docker, containersMap, Container, userId, removeVolume = false, dataDir) {
  const info = containersMap.get(userId);
  if (!info) {
    logger.warn(`No container found for user ${userId}`);
    return;
  }

  try {
    await ContainerOps.destroyContainer(docker, info.id, dataDir, userId, removeVolume);
    containersMap.delete(userId);

    try {
      await Container.delete(info.id);
    } catch (dbError) {
      logger.warn(`Failed to remove container from database: ${dbError.message}`);
    }
  } catch (error) {
    throw new Error(`Failed to destroy container for user ${userId}: ${error.message}`);
  }
}

// 当转换到停止状态时由 ContainerLifecycle 调用
/**
 * Stop container
 * @param {Object} docker - Docker client
 * @param {Map} containersMap - Containers map
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function stopContainer(docker, containersMap, userId) {
  const info = containersMap.get(userId);
  if (!info) {
    logger.warn(`No container found for user ${userId}`);
    return;
  }

  await ContainerOps.stopContainer(docker, info.id);
  info.status = 'stopped';
}

// 当从停止转换到运行时由 ContainerLifecycle 调用
/**
 * Start container
 * @param {Object} docker - Docker client
 * @param {Map} containersMap - Containers map
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 * @throws {Error} If container not found or start fails
 */
export async function startContainer(docker, containersMap, userId) {
  const info = containersMap.get(userId);
  if (!info) {
    throw new Error(`No container found for user ${userId}`);
  }

  await ContainerOps.startContainer(docker, info.id);
  info.status = 'running';
  info.lastActive = new Date();
}
