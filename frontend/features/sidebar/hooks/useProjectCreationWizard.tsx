/**
 * Project Creation Wizard Hook
 *
 * Custom hooks and handlers for Project Creation Wizard functionality.
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { logger } from '@/shared/utils/logger';
import {
  useProjectNameAvailabilityCheck,
  createDebouncedChecker,
  sanitizeProjectName,
  validateProjectName,
  createProjectApi,
  ProjectCreateError,
} from './projectNameValidation';
import type { NameAvailabilityStatus } from '../utils/projectNameUtils';
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
 * Custom hook to manage project creation wizard state and logic
 *
 * 输入框以空值起步（GitHub/Slack 式"先名后建"），placeholder 提供格式示例，
 * 引导用户主动命名而非无脑接受默认名（线上曾出现默认名连建 -1..-29 的垃圾项目）。
 *
 * @param {Function} onProjectCreated - Callback on successful creation
 * @param {Function} onClose - Callback to close modal
 * @returns {Object} Wizard state and handlers
 */
export function useProjectCreationWizard(
  onProjectCreated?: (project: any) => void,
  onClose?: () => void
) {
  // i18n：重名冲突时复用既有文案，避免直接展示后端原始 message
  const { t } = useTranslation();

  // Form state：空值起步，名字由用户第一手确定，天然去重
  const [projectName, setProjectName] = useState<string>('');

  // UI state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<NameAvailabilityStatus>('idle');

  const checkAvailability = useCallback(
    createDebouncedChecker(setAvailabilityStatus),
    []
  );

  // 输入变化时防抖检查可用性
  useProjectNameAvailabilityCheck(projectName, checkAvailability);

  /**
   * Handle project name input change
   *
   * @param {string} value - New input value
   */
  const handleProjectNameChange = (value: string): void => {
    const sanitizedName = sanitizeProjectName(value);
    setProjectName(sanitizedName);
    setError(null);
  };

  /**
   * Handle create project action
   */
  const handleCreateProject = async (): Promise<void> => {
    const validation = validateProjectName(projectName, availabilityStatus);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('[ProjectCreationWizard] ① 开始调用 createProjectApi, projectName:', projectName);
      const project = await createProjectApi(projectName);
      console.log('[ProjectCreationWizard] ② createProjectApi 返回:', JSON.stringify(project));

      // Success! Notify parent — MUST await to ensure refresh completes
      // before the modal closes, otherwise the sidebar won't show the new project.
      if (onProjectCreated && project) {
        console.log('[ProjectCreationWizard] ③ 调用 onProjectCreated ...');
        try {
          await onProjectCreated(project);
          console.log('[ProjectCreationWizard] ④ onProjectCreated 完成');
        } catch (callbackErr) {
          console.error('[ProjectCreationWizard] ④ onProjectCreated 异常:', callbackErr);
        }
      } else {
        console.warn('[ProjectCreationWizard] ③ 跳过 onProjectCreated — onProjectCreated:', !!onProjectCreated, 'project:', !!project, 'project value:', project);
      }

      if (onClose) {
        console.log('[ProjectCreationWizard] ⑤ 调用 onClose');
        onClose();
      }
    } catch (err) {
      console.error('[ProjectCreationWizard] ✖ createProjectApi 异常:', err);
      // 重名冲突：复用 i18n 友好文案，而非展示后端原始 message
      if (err instanceof ProjectCreateError && (err.status === 409 || err.code === 'ALREADY_EXISTS')) {
        setError(t('projectCreation.error.nameExists'));
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
        setError(errorMessage);
      }
    } finally {
      console.log('[ProjectCreationWizard] ⑥ finally — setIsCreating(false)');
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
      availabilityStatus === 'checking' ||
      // 输入未通过可用性检查前禁用（idle = 尚未检查），防止提交重名触发 409；
      // 检查由输入防抖触发（300ms），完成即转 available/unavailable
      availabilityStatus === 'idle'
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
