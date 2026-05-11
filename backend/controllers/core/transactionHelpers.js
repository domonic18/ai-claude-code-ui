/**
 * Transaction Helpers
 *
 * Database transaction management utilities.
 * Extracted from AuthController.js to reduce complexity.
 *
 * @module controllers/core/transactionHelpers
 */

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('controllers/core/transactionHelpers');

/**
 * Safely create container for user in background
 * @param {number} userId - User ID
 * @param {object} containerManager - Container manager instance
 */
export function createUserContainerInBackground(userId, containerManager) {
  containerManager.getOrCreateContainer(userId).catch(err => {
    logger.error(`[Transaction] Failed to create container for user ${userId}:`, err.message);
  });
}

