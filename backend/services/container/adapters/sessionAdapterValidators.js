/**
 * Session Adapter Validators
 *
 * Validation utilities for session adapter operations
 *
 * @module container/adapters/sessionAdapterValidators
 */

import { PathUtils } from '../../core/utils/path-utils.js';

// SessionAdapter 在所有操作前调用此函数验证项目标识符
/**
 * Validates project identifier
 * @param {string} projectIdentifier - Project identifier
 * @returns {Object} Validation result with valid flag and decoded value or error
 */
export function validateProjectIdentifier(projectIdentifier) {
  if (!projectIdentifier || typeof projectIdentifier !== 'string') {
    return {
      valid: false,
      error: 'Project identifier must be a non-empty string'
    };
  }

  const decoded = PathUtils.decodeProjectName(projectIdentifier);
  if (!decoded) {
    return {
      valid: false,
      error: 'Invalid project identifier format'
    };
  }

  return { valid: true, decoded };
}
