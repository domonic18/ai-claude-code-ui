/**
 * Base Discovery Error Handler
 *
 * Error handling utilities for project discovery
 *
 * @module projects/discovery/baseDiscoveryError
 */

// 在项目发现操作失败时调用，统一错误格式并添加元数据便于调试
/**
 * Standardizes error with metadata
 * @param {Error} error - Original error
 * @param {string} operation - Operation name
 * @param {string} name - Discovery name
 * @param {string} provider - Provider name
 * @returns {Error} Standardized error
 */
export function standardizeError(error, operation, name, provider) {
  const standardizedError = new Error(
    error.message || `${operation} failed in ${name}`
  );

  standardizedError.type = 'discovery_error';
  standardizedError.provider = provider;
  standardizedError.operation = operation;
  standardizedError.timestamp = new Date().toISOString();
  standardizedError.originalError = error;

  return standardizedError;
}
