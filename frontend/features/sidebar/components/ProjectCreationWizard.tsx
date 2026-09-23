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
 * Project Name Input Component (IME-safe, uncontrolled)
 *
 * 中文拼音等 IME 输入期间（组合态），受控组件每次 onChange 都会重设
 * input.value，浏览器据此强制终止组合——拼音被打断成半截英文直接进框
 * （如打 ceshi 中途变成框内 "ces" + 输入法只剩 "hi"）。
 *
 * 方案：完全非受控。React 在任何路径下都不写 DOM value——不传 value、
 * 不传 defaultValue、没有同步 effect。上一次"effect 镜像同步"方案仍有
 * 竞态：组合结束瞬间 input 事件携带的可能是替换前的旧 DOM 值（'cs'），
 * state 停在旧值，随后 effect 发现 DOM（已上屏'测试'）与 state（'cs'）
 * 不一致就把 DOM 写回 'cs'，刚上屏的中文被清掉，后续按键以普通字符
 * 进入（用户实测：选词后框内是 "cs1"）。
 *
 * state 镜像允许短暂落后于 DOM，下一次 input 事件自然对齐；两个方向
 * 的值都源自用户输入，永远不会互相覆盖丢字。重置场景（重开弹窗）由
 * 父组件 key 重建输入框实现，同样不需要写 value。
 */
function ProjectNameInput({
  onChange,
  placeholder,
  disabled,
  availabilityIndicator,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  availabilityIndicator: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Input
        id="project-name"
        type="text"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-24"
        disabled={disabled}
        autoFocus
        autoComplete="off"
      />
      {/* Availability Status Indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {availabilityIndicator}
      </div>
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
        <ProjectNameInput
          onChange={onNameChange}
          placeholder={projectNamePlaceholder}
          disabled={isCreating}
          availabilityIndicator={availabilityIndicator}
        />
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
  isOpen,
  onClose,
  onProjectCreated
}: ProjectCreationWizardProps) => {
  const { t } = useTranslation();

  const {
    projectName,
    isCreating,
    error,
    handleProjectNameChange,
    handleCreateProject,
    getAvailabilityStatusIndicator,
    shouldDisableCreateButton,
  } = useProjectCreationWizard(onProjectCreated, onClose);

  return (
    // isOpen 变化（弹窗重开）时 key 重建整棵子树：非受控输入框随之重置为空，
    // 这是唯一需要的"外部重置"路径，替代任何运行时写 value 的方案（IME 安全）
    <div key={isOpen ? 'open' : 'closed'} className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4">
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
