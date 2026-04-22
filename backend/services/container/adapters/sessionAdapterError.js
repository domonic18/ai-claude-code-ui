/**
 * Session Adapter Error Handler
 *
 * Error handling utilities for session adapter operations
 *
 * @module container/adapters/sessionAdapterError
 */

// SessionAdapter 在任何操作失败时调用此函数标准化错误对象
/**
 * Standardizes error with metadata
 * @param {Error} error - Original error
 * @param {string} operation - Operation name
 * @param {number} userId - User ID
 * @returns {Error} Standardized error
 */
export function standardizeError(error, operation, userId) {
  const standardizedError = new Error(
    error.message || `${operation} failed in container`
  );

  standardizedError.type = 'container_session_error';
  standardizedError.operation = operation;
  standardizedError.userId = userId;
  standardizedError.timestamp = new Date().toISOString();
  standardizedError.originalError = error;

  return standardizedError;
}
