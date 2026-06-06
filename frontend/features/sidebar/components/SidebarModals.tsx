/**
 * Sidebar Modals Component
 *
 * Extracted modal rendering logic for the Sidebar.
 * Handles:
 * - Project Creation Wizard (rendered via portal)
 * - Delete Session Confirmation Dialog
 * - Delete Project Confirmation Dialog
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/components/ui';
import ProjectCreationWizard from './ProjectCreationWizard';
import type { Project } from '../types/sidebar.types';

interface SidebarModalsProps {
  /** Show project creation wizard */
  showNewProject: boolean;
  /** Set show new project state */
  setShowNewProject: (show: boolean) => void;
  /** Create project function */
  createProject: (path: string) => Promise<Project>;
  /** On project select callback */
  onProjectSelect?: (project: Project) => void;
  /** On refresh callback */
  onRefresh?: (options?: { force?: boolean }) => void | Promise<void>;
  /** Delete confirmation state */
  deleteConfirmState: { isOpen: boolean; sessionId?: string };
  /** Is deleting session */
  isDeleting: boolean;
  /** Handle confirm session delete */
  handleConfirmSessionDelete: () => Promise<void>;
  /** Handle cancel session delete */
  handleCancelSessionDelete: () => void;
  /** Project delete confirmation state */
  projectDeleteConfirmState: { isOpen: boolean; projectName: string; displayName: string; sessionCount: number };
  /** Is deleting project */
  isDeletingProject: boolean;
  /** Handle confirm project delete */
  handleConfirmProjectDelete: () => Promise<void>;
  /** Handle cancel project delete */
  handleCancelProjectDelete: () => void;
}

export function SidebarModals({
  showNewProject,
  setShowNewProject,
  createProject,
  onProjectSelect,
  onRefresh,
  deleteConfirmState,
  isDeleting,
  handleConfirmSessionDelete,
  handleCancelSessionDelete,
  projectDeleteConfirmState,
  isDeletingProject,
  handleConfirmProjectDelete,
  handleCancelProjectDelete,
}: SidebarModalsProps) {
  const { t } = useTranslation();

  const projectDeleteMessage = projectDeleteConfirmState.sessionCount > 0
    ? t('sidebar.confirmDeleteProjectWithSessions', {
        count: projectDeleteConfirmState.sessionCount,
        project: projectDeleteConfirmState.projectName,
      })
    : t('sidebar.confirmDeleteProject');

  return (
    <>
      {/* Project Creation Wizard Modal */}
      {showNewProject &&
        createPortal(
          <ProjectCreationWizard
            isOpen={showNewProject}
            onClose={() => setShowNewProject(false)}
            onProjectCreated={async (newProject) => {
              console.log('[SidebarModals] A onProjectCreated 触发, project:', JSON.stringify(newProject)?.slice(0, 200));
              if (onProjectSelect && newProject) {
                console.log('[SidebarModals] B 调用 onProjectSelect');
                onProjectSelect(newProject);
              }
              if (onRefresh) {
                console.log('[SidebarModals] C 调用 onRefresh (force=true, 跳过去重)');
                await onRefresh({ force: true });
                console.log('[SidebarModals] D onRefresh 完成');
              } else {
                console.warn('[SidebarModals] C onRefresh 未传入!');
              }
              console.log('[SidebarModals] E 关闭弹窗 setShowNewProject(false)');
              setShowNewProject(false);
            }}
          />,
          document.body
        )}

      {/* Delete Session Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmState.isOpen}
        title={t('sidebar.confirmDeleteSession') || 'Delete Session'}
        message={
          t('sidebar.confirmDeleteSessionMessage') ||
          'Are you sure you want to delete this session? This action cannot be undone.'
        }
        confirmLabel={t('sidebar.delete') || 'Delete'}
        cancelLabel={t('sidebar.cancel') || 'Cancel'}
        type="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmSessionDelete}
        onCancel={handleCancelSessionDelete}
      />

      {/* Delete Project Confirmation Dialog */}
      <ConfirmDialog
        isOpen={projectDeleteConfirmState.isOpen}
        title={t('sidebar.deleteProjectTitle', { project: projectDeleteConfirmState.displayName || projectDeleteConfirmState.projectName })}
        message={projectDeleteMessage}
        confirmLabel={t('sidebar.confirmDeleteLabel') || 'Confirm Delete'}
        cancelLabel={t('sidebar.cancel') || 'Cancel'}
        type="danger"
        isLoading={isDeletingProject}
        onConfirm={handleConfirmProjectDelete}
        onCancel={handleCancelProjectDelete}
      />
    </>
  );
}
