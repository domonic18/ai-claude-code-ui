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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FolderPlus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { api } from '@/shared/services';
import type { ProjectCreationWizardProps } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

// Default project name - will be set from translation in component

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
      logger.warn('[checkNameAvailability] API response not OK:', response.status);
      return 'error';
    }

    const data = await response.json();
    logger.info('[checkNameAvailability] API response:', data);

    // Check if the project name already exists in suggestions
    if (data.data?.suggestions && Array.isArray(data.data.suggestions)) {
      const exists = data.data.suggestions.some(
        (item: { path: string; type: string; name?: string }) => {
          // Check by path ending or by name field
          const pathMatch = item.path?.endsWith(`/${projectName}`);
          const nameMatch = item.name === projectName;
          return item.type === 'directory' && (pathMatch || nameMatch);
        }
      );
      logger.info('[checkNameAvailability] Project exists:', projectName, exists);
      return exists ? 'unavailable' : 'available';
    }

    // If we can't determine, assume available
    logger.warn('[checkNameAvailability] No suggestions in response, assuming available');
    return 'available';
  } catch (error) {
    logger.error('[checkNameAvailability] Error:', error);
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

/**
 * Custom hook to initialize project name on mount
 *
 * @param {string} baseProjectName - Base project name from translation
 * @param {Function} setProjectName - State setter for project name
 * @param {React.MutableRefObject<boolean>} isInitialLoad - Ref to track initial load
 */
function useProjectNameInitialization(
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
function useProjectNameAvailabilityCheck(
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
 * Wizard Header Component
 *
 * Displays the modal header with title, icon, and close button.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.isCreating - Whether project is being created
 * @param {string} props.title - Modal title
 */
function WizardHeader({ onClose, isCreating, title }: {
  onClose: () => void;
  isCreating: boolean;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
          <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
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
  );
}

/**
 * Wizard Content Component
 *
 * Displays the main content area including error display, project name input,
 * info card, and path preview.
 *
 * @param {Object} props - Component props
 * @param {string | null} props.error - Error message to display
 * @param {string} props.projectName - Current project name
 * @param {boolean} props.isCreating - Whether project is being created
 * @param {Function} props.onNameChange - Name change handler
 * @param {Function} props.getAvailabilityIndicator - Availability status indicator renderer
 * @param {string} props.projectNameLabel - Project name label text
 * @param {string} props.projectNamePlaceholder - Project name placeholder text
 * @param {string} props.projectNameHint - Project name hint text
 * @param {string} props.infoCardText - Info card content
 * @param {string} props.pathPreviewLabel - Path preview label
 */
function WizardContent({
  error,
  projectName,
  isCreating,
  onNameChange,
  getAvailabilityIndicator,
  projectNameLabel,
  projectNamePlaceholder,
  projectNameHint,
  infoCardText,
  pathPreviewLabel,
}: {
  error: string | null;
  projectName: string;
  isCreating: boolean;
  onNameChange: (value: string) => void;
  getAvailabilityIndicator: () => React.ReactNode;
  projectNameLabel: string;
  projectNamePlaceholder: string;
  projectNameHint: string;
  infoCardText: string;
  pathPreviewLabel: string;
}) {
  return (
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
          {projectNameLabel}
        </label>
        <div className="relative">
          <Input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={projectNamePlaceholder}
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
          {projectNameHint}
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {infoCardText}
        </p>
      </div>

      {/* Project Path Preview */}
      {projectName && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{pathPreviewLabel}</p>
          <p className="text-sm font-mono text-gray-900 dark:text-white">
            /workspace/{projectName}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Wizard Footer Component
 *
 * Displays the modal footer with cancel and create buttons.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onCreate - Create project handler
 * @param {boolean} props.isCreating - Whether project is being created
 * @param {boolean} props.isCreateDisabled - Whether create button is disabled
 * @param {string} props.cancelText - Cancel button text
 * @param {string} props.createButton - Create button text
 * @param {string} props.creatingText - Creating button text
 */
function WizardFooter({
  onClose,
  onCreate,
  isCreating,
  isCreateDisabled,
  cancelText,
  createButton,
  creatingText,
}: {
  onClose: () => void;
  onCreate: () => void;
  isCreating: boolean;
  isCreateDisabled: boolean;
  cancelText: string;
  createButton: string;
  creatingText: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
      <Button
        variant="outline"
        onClick={onClose}
        disabled={isCreating}
      >
        {cancelText}
      </Button>
      <Button
        onClick={onCreate}
        disabled={isCreateDisabled}
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {creatingText}
          </>
        ) : (
          <>
            <Check className="w-4 h-4 mr-2" />
            {createButton}
          </>
        )}
      </Button>
    </div>
  );
}

const ProjectCreationWizard = ({
  onClose,
  onProjectCreated
}: ProjectCreationWizardProps) => {
  const { t } = useTranslation();
  const defaultProjectName = t('projectCreation.defaultName');

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

  const handleNameChange = (value: string) => {
    handleProjectNameChange(value, setProjectName, setError);
  };

  const handleCreate = async () => {
    await handleCreateProject(
      projectName, availabilityStatus, t, setIsCreating, setError, onProjectCreated, onClose
    );
  };

  const getAvailabilityIndicator = () => getAvailabilityStatusIndicator(availabilityStatus, t);
  const isCreateDisabled = () => shouldDisableCreateButton(isCreating, projectName, availabilityStatus);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-md border-0 sm:border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <WizardHeader
          onClose={onClose}
          isCreating={isCreating}
          title={t('projectCreation.title')}
        />

        <WizardContent error={error} projectName={projectName} isCreating={isCreating} onNameChange={handleNameChange}
          getAvailabilityIndicator={getAvailabilityIndicator} projectNameLabel={t('projectCreation.projectName')}
          projectNamePlaceholder={t('projectCreation.projectNamePlaceholder')} projectNameHint={t('projectCreation.projectNameHint')}
          infoCardText={t('projectCreation.infoCard')} pathPreviewLabel={t('projectCreation.pathPreview')} />
        <WizardFooter onClose={onClose} onCreate={handleCreate} isCreating={isCreating}
          isCreateDisabled={isCreateDisabled()} cancelText={t('common.cancel')} createButton={t('projectCreation.createButton')} creatingText={t('projectCreation.creating')} />
      </div>
    </div>
  );
}

/**
 * Get availability status indicator component
 *
 * @param {NameAvailabilityStatus} status - Current availability status
 * @param {Function} t - Translation function
 * @returns {React.ReactNode | null} Status indicator component
 */
function getAvailabilityStatusIndicator(status: NameAvailabilityStatus, t: any): React.ReactNode | null {
  switch (status) {
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
}

/**
 * Check if create button should be disabled
 *
 * @param {boolean} isCreating - Whether project is being created
 * @param {string} projectName - Current project name
 * @param {NameAvailabilityStatus} availabilityStatus - Current availability status
 * @returns {boolean} Whether create button is disabled
 */
function shouldDisableCreateButton(
  isCreating: boolean,
  projectName: string,
  availabilityStatus: NameAvailabilityStatus
): boolean {
  return (
    isCreating ||
    !projectName ||
    projectName.trim().length === 0 ||
    availabilityStatus === 'unavailable' ||
    availabilityStatus === 'checking'
  );
}

/**
 * Handle project name input change
 *
 * @param {string} value - New input value
 * @param {Function} setProjectName - State setter for project name
 * @param {Function} setError - State setter for error
 */
function handleProjectNameChange(
  value: string,
  setProjectName: (name: string) => void,
  setError: (error: string | null) => void
): void {
  // Allow alphanumeric, hyphens, underscores, and Chinese characters
  const sanitizedName = value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9-_]/g, '');
  setProjectName(sanitizedName);
  setError(null);
}

/**
 * Handle create project action
 *
 * @param {string} projectName - Project name to create
 * @param {NameAvailabilityStatus} availabilityStatus - Current availability status
 * @param {Function} t - Translation function
 * @param {Function} setIsCreating - State setter for creating state
 * @param {Function} setError - State setter for error
 * @param {Function} onProjectCreated - Callback on successful creation
 * @param {Function} onClose - Callback to close modal
 */
async function handleCreateProject(
  projectName: string,
  availabilityStatus: NameAvailabilityStatus,
  t: any,
  setIsCreating: (creating: boolean) => void,
  setError: (error: string | null) => void,
  onProjectCreated?: (project: any) => void,
  onClose?: () => void
): Promise<void> {
  if (!projectName || projectName.trim().length === 0) {
    setError(t('projectCreation.error.emptyName'));
    return;
  }

  if (availabilityStatus === 'unavailable') {
    setError(t('projectCreation.error.nameExists'));
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
}

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
