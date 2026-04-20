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

import { useTranslation } from 'react-i18next';
import { X, FolderPlus, AlertCircle, Loader2, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import type { ProjectCreationWizardProps } from '../types/sidebar.types';
import { useProjectCreationWizard } from '../hooks/useProjectCreationWizard.tsx';

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
 * @param {React.ReactNode} props.availabilityIndicator - Availability status indicator
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
  availabilityIndicator,
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
  availabilityIndicator: React.ReactNode;
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
            {availabilityIndicator}
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

/**
 * Project Creation Wizard Component
 *
 * Main component for creating new projects with name validation
 * and availability checking.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Close modal callback
 * @param {Function} props.onProjectCreated - Callback on successful project creation
 */
const ProjectCreationWizard = ({
  onClose,
  onProjectCreated
}: ProjectCreationWizardProps) => {
  const { t } = useTranslation();
  const defaultProjectName = t('projectCreation.defaultName');

  const {
    projectName,
    isCreating,
    error,
    handleProjectNameChange,
    handleCreateProject,
    getAvailabilityStatusIndicator,
    shouldDisableCreateButton,
  } = useProjectCreationWizard(defaultProjectName, onProjectCreated, onClose);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-md border-0 sm:border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <WizardHeader
          onClose={onClose}
          isCreating={isCreating}
          title={t('projectCreation.title')}
        />

        <WizardContent
          error={error}
          projectName={projectName}
          isCreating={isCreating}
          onNameChange={handleProjectNameChange}
          availabilityIndicator={getAvailabilityStatusIndicator(t)}
          projectNameLabel={t('projectCreation.projectName')}
          projectNamePlaceholder={t('projectCreation.projectNamePlaceholder')}
          projectNameHint={t('projectCreation.projectNameHint')}
          infoCardText={t('projectCreation.infoCard')}
          pathPreviewLabel={t('projectCreation.pathPreview')}
        />

        <WizardFooter
          onClose={onClose}
          onCreate={handleCreateProject}
          isCreating={isCreating}
          isCreateDisabled={shouldDisableCreateButton()}
          cancelText={t('common.cancel')}
          createButton={t('projectCreation.createButton')}
          creatingText={t('projectCreation.creating')}
        />
      </div>
    </div>
  );
};

export default ProjectCreationWizard;
