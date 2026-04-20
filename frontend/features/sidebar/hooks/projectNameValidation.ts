/**
 * Project Name Validation
 * =======================
 *
 * Name availability checking and validation for project creation.
 * Extracted from useProjectCreationWizard.tsx to reduce complexity.
 *
 * @module hooks/projectNameValidation
 */

import { useEffect } from 'react';
import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import {
  checkNameAvailability,
  generateAvailableName,
  debounce,
  CHECK_DEBOUNCE_MS,
  type NameAvailabilityStatus,
} from '../utils/projectNameUtils';

/**
 * Custom hook to initialize project name on mount
 *
 * @param {string} baseProjectName - Base project name from translation
 * @param {Function} setProjectName - State setter for project name
 * @param {React.MutableRefObject<boolean>} isInitialLoad - Ref to track initial load
 */
export function useProjectNameInitialization(
  baseProjectName: string,
  setProjectName: (name: string) => void,
  isInitialLoad: React.MutableRefObject<boolean>
): void {
  useEffect(() => {
    const initializeName = async () => {
      const availableName = await generateAvailableName(baseProjectName);
      setProjectName(availableName);
      // Mark initial load as complete after setting the name
      isInitialLoad.current = false;
    };

    initializeName();
  }, [baseProjectName, setProjectName, isInitialLoad]);
}

/**
 * Custom hook to check project name availability
 *
 * @param {string} projectName - Current project name
 * @param {React.MutableRefObject<boolean>} isInitialLoad - Ref to track initial load
 * @param {Function} checkAvailability - Debounced availability check function
 */
export function useProjectNameAvailabilityCheck(
  projectName: string,
  isInitialLoad: React.MutableRefObject<boolean>,
  checkAvailability: (name: string) => void
): void {
  useEffect(() => {
    if (isInitialLoad.current) {
      // Skip check during initial load
      return;
    }
    checkAvailability(projectName);
  }, [projectName, checkAvailability, isInitialLoad]);
}

/**
 * Create debounced availability checker
 *
 * @param {Function} setAvailabilityStatus - State setter for availability status
 * @returns {Function} Debounced check function
 */
export function createDebouncedChecker(
  setAvailabilityStatus: React.Dispatch<React.SetStateAction<NameAvailabilityStatus>>
): (name: string) => void {
  return debounce(async (name: string) => {
    if (!name || name.trim().length === 0) {
      setAvailabilityStatus('idle');
      return;
    }

    setAvailabilityStatus('checking');
    const status = await checkNameAvailability(name);
    setAvailabilityStatus(status);
  }, CHECK_DEBOUNCE_MS);
}

/**
 * Sanitize project name input
 *
 * @param {string} value - Raw input value
 * @returns {string} Sanitized project name
 */
export function sanitizeProjectName(value: string): string {
  // Allow alphanumeric, hyphens, underscores, and Chinese characters
  return value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9-_]/g, '');
}

/**
 * Validate project name before creation
 *
 * @param {string} projectName - Project name to validate
 * @param {NameAvailabilityStatus} availabilityStatus - Availability status
 * @returns {{valid: boolean, error: string | null}} Validation result
 */
export function validateProjectName(
  projectName: string,
  availabilityStatus: NameAvailabilityStatus
): { valid: boolean; error: string | null } {
  if (!projectName || projectName.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty' };
  }

  if (availabilityStatus === 'unavailable') {
    return { valid: false, error: 'A project with this name already exists' };
  }

  return { valid: true, error: null };
}

/**
 * Handle project creation API call
 *
 * @param {string} projectName - Project name
 * @returns {Promise<any>} Created project data
 * @throws {Error} If creation fails
 */
export async function createProjectApi(projectName: string): Promise<any> {
  // Default workspace path for user projects
  const workspacePath = `/workspace/${projectName}`;

  logger.info('[ProjectCreationWizard] Creating project:', workspacePath);

  const response = await api.createProject(workspacePath);

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    logger.error('[ProjectCreationWizard] Non-JSON response:', text);
    throw new Error('Server returned an unexpected response');
  }

  const data = await response.json();
  logger.info('[ProjectCreationWizard] Response:', data);

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to create project');
  }

  return data.project;
}
