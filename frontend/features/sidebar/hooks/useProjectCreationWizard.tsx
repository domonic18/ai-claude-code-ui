/**
 * Project Creation Wizard Hook
 *
 * Custom hooks and handlers for Project Creation Wizard functionality.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
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
 * Return type for useProjectCreationWizard hook
 */
export interface UseProjectCreationWizardReturn {
  /** Current project name */
  projectName: string;
  /** Whether project is being created */
  isCreating: boolean;
  /** Error message if any */
  error: string | null;
  /** Handle project name input change */
  handleProjectNameChange: (value: string) => void;
  /** Handle create project action */
  handleCreateProject: () => Promise<void>;
  /** Get availability status indicator component */
  getAvailabilityStatusIndicator: (t: any) => React.ReactNode | null;
  /** Check if create button should be disabled */
  shouldDisableCreateButton: () => boolean;
  /** Set project name (for advanced use cases) */
  setProjectName: (name: string) => void;
  /** Set error message (for advanced use cases) */
  setError: (error: string | null) => void;
  /** Set creating state (for advanced use cases) */
  setIsCreating: (creating: boolean) => void;
}

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
 * Custom hook to manage project creation wizard state and logic
 *
 * @param {string} defaultProjectName - Default project name from translation
 * @param {Function} onProjectCreated - Callback on successful creation
 * @param {Function} onClose - Callback to close modal
 * @returns {Object} Wizard state and handlers
 */
export function useProjectCreationWizard(
  defaultProjectName: string,
  onProjectCreated?: (project: any) => void,
  onClose?: () => void
) {
  // Form state
  const [projectName, setProjectName] = useState<string>(defaultProjectName);

  // UI state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<NameAvailabilityStatus>('idle');

  // Track initial load to skip check for the auto-generated name
  const isInitialLoad = useRef(true);

  const checkAvailability = useCallback(
    debounce(async (name: string) => {
      if (!name || name.trim().length === 0) {
        setAvailabilityStatus('idle');
        return;
      }

      setAvailabilityStatus('checking');
      const status = await checkNameAvailability(name);
      setAvailabilityStatus(status);
    }, CHECK_DEBOUNCE_MS),
    []
  );

  // Initialize project name and availability checking
  useProjectNameInitialization(defaultProjectName, setProjectName, isInitialLoad);
  useProjectNameAvailabilityCheck(projectName, isInitialLoad, checkAvailability);

  /**
   * Handle project name input change
   *
   * @param {string} value - New input value
   */
  const handleProjectNameChange = (value: string): void => {
    // Allow alphanumeric, hyphens, underscores, and Chinese characters
    const sanitizedName = value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9-_]/g, '');
    setProjectName(sanitizedName);
    setError(null);
  };

  /**
   * Handle create project action
   */
  const handleCreateProject = async (): Promise<void> => {
    if (!projectName || projectName.trim().length === 0) {
      setError('Project name cannot be empty');
      return;
    }

    if (availabilityStatus === 'unavailable') {
      setError('A project with this name already exists');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
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

      // Success! Notify parent
      if (onProjectCreated && data.project) {
        onProjectCreated(data.project);
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      logger.error('[ProjectCreationWizard] Error:', err);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Get availability status indicator component
   *
   * @param {Function} t - Translation function
   * @returns {React.ReactNode | null} Status indicator component
   */
  const getAvailabilityStatusIndicator = (t: any): React.ReactNode | null => {
    switch (availabilityStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('projectCreation.status.checking')}</span>
          </div>
        );
      case 'available':
        return (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span>{t('projectCreation.status.available')}</span>
          </div>
        );
      case 'unavailable':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{t('projectCreation.status.unavailable')}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            <span>{t('projectCreation.status.error')}</span>
          </div>
        );
      default:
        return null;
    }
  };

  /**
   * Check if create button should be disabled
   *
   * @returns {boolean} Whether create button is disabled
   */
  const shouldDisableCreateButton = (): boolean => {
    return (
      isCreating ||
      !projectName ||
      projectName.trim().length === 0 ||
      availabilityStatus === 'unavailable' ||
      availabilityStatus === 'checking'
    );
  };

  return {
    // State
    projectName,
    isCreating,
    error,
    availabilityStatus,
    // Handlers
    handleProjectNameChange,
    handleCreateProject,
    getAvailabilityStatusIndicator,
    shouldDisableCreateButton,
    // Setters (for advanced use cases)
    setProjectName,
    setError,
    setIsCreating,
  } as UseProjectCreationWizardReturn;
}
