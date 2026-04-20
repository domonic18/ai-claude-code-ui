/**
 * Base Discovery Error Handler
 *
 * Error handling utilities for project discovery
 *
 * @module projects/discovery/baseDiscoveryError
 */

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
