/**
 * Base Discovery Validators
 *
 * Validation utilities for project discovery
 *
 * @module projects/discovery/baseDiscoveryValidators
 */

import { PathUtils } from '../../core/utils/path-utils.js';

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

  // Check if it's a valid project path
  const decoded = PathUtils.decodeProjectName(projectIdentifier);
  if (!decoded) {
    return {
      valid: false,
      error: 'Invalid project identifier format'
    };
  }

  return { valid: true, decoded };
}
