/**
 * File Operation Builders
 *
 * Helper functions for building file operation options
 * Extracted from FileController.js to reduce complexity
 *
 * @module controllers/api/fileOperationBuilders
 */

/**
 * Builds standard file operation options
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @param {Object} req - Express request object (for containerMode)
 * @returns {Object} File operation options
 */
export function buildFileOperationOptions(userId, projectName, req) {
  return {
    userId,
    projectPath: projectName,
    isContainerProject: true,
    containerMode: req.containerMode
  };
}

/**
 * Builds file operation options with depth and hidden file settings
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @param {Object} req - Express request object (for containerMode)
 * @param {Object} query - Query parameters
 * @returns {Object} File operation options with depth and includeHidden
 */
export function buildFileTreeOptions(userId, projectName, req, query) {
  const { depth = 3, showHidden = false } = query;

  return {
    userId,
    projectPath: projectName,
    isContainerProject: true,
    containerMode: req.containerMode,
    depth: parseInt(depth, 10),
    includeHidden: showHidden === 'true' || showHidden === true
  };
}

/**
 * Validates required file path parameter
 * @param {string} filePath - File path to validate
 * @param {string} paramName - Parameter name for error message
 * @throws {ValidationError} If filePath is missing
 */
export function validateFilePath(filePath, paramName = 'filePath') {
  if (!filePath) {
    const { ValidationError } = require('../../middleware/error-handler.middleware.js');
    throw new ValidationError(`${paramName} is required`);
  }
}
