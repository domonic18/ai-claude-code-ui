/**
 * Project Creation Wizard Component
 *
 * Simplified project creation dialog for non-technical users.
 * Features:
 * - Single-step workflow
 * - Project name input with availability checking
 * - Auto-generated default name with numbering
 * - Real-time validation feedback
 */

import { useState, useEffect, useCallback } from 'react';
import { X, FolderPlus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { api } from '@/shared/services';
import type { ProjectCreationWizardProps } from '../types/sidebar.types';

// Default project name
const DEFAULT_PROJECT_NAME = 'my-project';

// Debounce delay for name checking (ms)
const CHECK_DEBOUNCE_MS = 300;

/**
 * Name availability status
 */
type NameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

/**
 * Check if a project name is available
 */
async function checkNameAvailability(projectName: string): Promise<NameAvailabilityStatus> {
  if (!projectName || projectName.trim().length === 0) {
    return 'idle';
  }

  try {
    // Use browseFilesystem API to check if path exists
    // Default base path for user projects is typically /workspace
    const response = await api.browseFilesystem('/workspace');

    if (!response.ok) {
      return 'error';
    }

    const data = await response.json();

    // Check if the project name already exists in suggestions
    if (data.data?.suggestions) {
      const exists = data.data.suggestions.some(
        (item: { path: string; type: string }) =>
          item.type === 'directory' && item.path.endsWith(`/${projectName}`)
      );
      return exists ? 'unavailable' : 'available';
    }

    // If we can't determine, assume available
    return 'available';
  } catch (error) {
    console.error('Error checking name availability:', error);
    return 'error';
  }
}

/**
 * Generate next available project name with numbering
 */
async function generateAvailableName(baseName: string): Promise<string> {
  let counter = 1;
  let suggestedName = baseName;

  while (counter <= 100) {
    const status = await checkNameAvailability(suggestedName);
    if (status === 'available') {
      return suggestedName;
    }
    if (status === 'idle' || status === 'error') {
      // Can't determine, return the suggested name anyway
      return suggestedName;
    }
    suggestedName = `${baseName}-${counter}`;
    counter++;
  }

  return `${baseName}-${Date.now()}`;
}

const ProjectCreationWizard = ({
  onClose,
  onProjectCreated
}: ProjectCreationWizardProps) => {
  // Form state
  const [projectName, setProjectName] = useState<string>(DEFAULT_PROJECT_NAME);

  // UI state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<NameAvailabilityStatus>('idle');

  /**
   * Check project name availability with debounce
   */
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

  /**
   * Initialize with available project name on mount
   */
  useEffect(() => {
    const initializeName = async () => {
      const availableName = await generateAvailableName(DEFAULT_PROJECT_NAME);
      setProjectName(availableName);
    };

    initializeName();
  }, []);

  /**
   * Check availability when project name changes
   */
  useEffect(() => {
    if (projectName === DEFAULT_PROJECT_NAME) {
      // Skip check for initial default name
      return;
    }
    checkAvailability(projectName);
  }, [projectName, checkAvailability]);

  /**
   * Handle project name input change
   */
  const handleNameChange = (value: string) => {
    // Allow only alphanumeric, hyphens, and underscores
    const sanitizedName = value.replace(/[^a-zA-Z0-9-_]/g, '');
    setProjectName(sanitizedName);
    setError(null);
  };

  /**
   * Handle create project
   */
  const handleCreate = async () => {
    if (!projectName || projectName.trim().length === 0) {
      setError('Please enter a project name');
      return;
    }

    if (availabilityStatus === 'unavailable') {
      setError('A project with this name already exists. Please choose a different name.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Default workspace path for user projects
      const workspacePath = `/workspace/${projectName}`;

      console.log('[ProjectCreationWizard] Creating project:', workspacePath);

      const response = await api.createProject(workspacePath);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[ProjectCreationWizard] Non-JSON response:', text);
        throw new Error('Server returned an unexpected response');
      }

      const data = await response.json();
      console.log('[ProjectCreationWizard] Response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create project');
      }

      // Success! Notify parent
      if (onProjectCreated && data.project) {
        onProjectCreated(data.project);
      }

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      console.error('[ProjectCreationWizard] Error:', err);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Get availability status icon and color
   */
  const getAvailabilityIndicator = () => {
    switch (availabilityStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking...</span>
          </div>
        );
      case 'available':
        return (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span>Available</span>
          </div>
        );
      case 'unavailable':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>Already exists</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            <span>Unable to check</span>
          </div>
        );
      default:
        return null;
    }
  };

  /**
   * Check if create button should be disabled
   */
  const isCreateDisabled = () => {
    return (
      isCreating ||
      !projectName ||
      projectName.trim().length === 0 ||
      availabilityStatus === 'unavailable' ||
      availabilityStatus === 'checking'
    );
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-md border-0 sm:border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create New Project
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isCreating}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {/* Project Name Input */}
          <div className="space-y-3">
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project Name
            </label>
            <div className="relative">
              <Input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter project name"
                className="w-full pr-24"
                disabled={isCreating}
                autoFocus
                autoComplete="off"
              />
              {/* Availability Status Indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getAvailabilityIndicator()}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use letters, numbers, hyphens, and underscores only
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              A new folder will be created in your workspace with this name.
              You can start coding with Claude right away!
            </p>
          </div>

          {/* Project Path Preview */}
          {projectName && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Project will be created at:</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white">
                /workspace/{projectName}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreateDisabled()}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Project
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple debounce utility function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export default ProjectCreationWizard;
