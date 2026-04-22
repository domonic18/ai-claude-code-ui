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

// 处理业务逻辑，供路由层调用
/**
 * Safely rollback transaction with error handling
 * @param {boolean} transactionActive - Whether transaction is active
 */
export function safeRollback(transactionActive) {
  if (transactionActive) {
    try {
      const { db } = require('../../database/db.js');
      db().prepare('ROLLBACK').run();
    } catch (rollbackError) {
      // Ignore rollback errors (transaction may already be closed)
      logger.error('[Transaction] Rollback error:', rollbackError.message);
    }
  }
}

// 创建新资源，供路由层调用
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

