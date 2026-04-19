/**
 * Sidebar Modals Component
 *
 * Extracted modal rendering logic for the Sidebar.
 * Handles:
 * - Project Creation Wizard (rendered via portal)
 * - Delete Session Confirmation Dialog
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/components/ui';
import ProjectCreationWizard from './ProjectCreationWizard';
import { logger } from '@/shared/utils/logger';
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
  /** Delete confirmation state */
  deleteConfirmState: { isOpen: boolean; sessionId?: string };
  /** Is deleting session */
  isDeleting: boolean;
  /** Handle confirm session delete */
  handleConfirmSessionDelete: () => Promise<void>;
  /** Handle cancel session delete */
  handleCancelSessionDelete: () => void;
}

export function SidebarModals({
  showNewProject,
  setShowNewProject,
  createProject,
  onProjectSelect,
  deleteConfirmState,
  isDeleting,
  handleConfirmSessionDelete,
  handleCancelSessionDelete,
}: SidebarModalsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Project Creation Wizard Modal */}
      {showNewProject &&
        createPortal(
          <ProjectCreationWizard
            isOpen={showNewProject}
            onClose={() => setShowNewProject(false)}
            onProjectCreated={async (newProject) => {
              try {
                const created = await createProject(
                  newProject.fullPath || (newProject as any).path
                );
                if (onProjectSelect && created) {
                  onProjectSelect(created);
                }
                setShowNewProject(false);
              } catch (error) {
                logger.error('Error creating project:', error);
              }
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
    </>
  );
}
