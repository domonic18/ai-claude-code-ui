/**
 * Project Controller Helpers
 *
 * Helper functions for project controller validation and operations
 *
 * @module controllers/api/projectControllerHelpers
 */

import { ValidationError } from '../../middleware/error-handler.middleware.js';

// 处理业务逻辑，供路由层调用
/**
 * Validates display name for project renaming
 * @param {string} displayName - Display name to validate
 * @throws {ValidationError} If validation fails
 */
export function validateDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    throw new ValidationError('Display name is required');
  }
}

// 处理业务逻辑，供路由层调用
/**
 * Validates summary for session renaming
 * @param {string} summary - Summary to validate
 * @throws {ValidationError} If validation fails
 */
export function validateSummary(summary) {
  if (!summary || typeof summary !== 'string') {
    throw new ValidationError('Summary is required');
  }

  const trimmedSummary = summary.trim();

  if (trimmedSummary.length === 0) {
    throw new ValidationError('Summary cannot be empty');
  }

  if (trimmedSummary.length > 200) {
    throw new ValidationError('Summary is too long (max 200 characters)');
  }

  return trimmedSummary;
}

// 处理业务逻辑，供路由层调用
/**
 * Validates workspace creation parameters
 * @param {string} workspaceType - Type of workspace ('new' or 'existing')
 * @param {string} workspacePath - Path for workspace
 * @throws {ValidationError} If validation fails
 */
export function validateWorkspaceParams(workspaceType, workspacePath) {
  if (!workspaceType || !workspacePath) {
    throw new ValidationError('workspaceType and path are required');
  }
}

// 处理业务逻辑，供路由层调用
/**
 * Validates manual project creation parameters
 * @param {string} inputPath - Path to validate
 * @returns {Object} Validated and cleaned path and project name
 * @throws {ValidationError} If validation fails
 */
export function validateProjectCreation(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new ValidationError('Path is required');
  }

  const cleanPath = inputPath.trim();
  const projectName = cleanPath.split('/').filter(Boolean).pop() ||
                      cleanPath.replace(/^\//, '');

  if (!projectName) {
    throw new ValidationError('Invalid project path');
  }

  return { cleanPath, projectName };
}

// 处理业务逻辑，供路由层调用
/**
 * Finds project by name or ID from list of projects
 * @param {Array} projects - Array of projects
 * @param {string} projectId - Project name or ID
 * @returns {Object|null} Found project or null
 */
export function findProjectByIdentifier(projects, projectId) {
  return projects.find(p => p.name === projectId || p.id === projectId) || null;
}

