/**
 * Project API Helpers
 *
 * Helper functions for project API operations
 */

import { api } from '@/shared/services';
import { getSidebarService } from '../services';
import type { Project, ProjectFile, Session } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';
import i18n from '@/shared/i18n';

/**
 * Get project files
 *
 * @param projectName - Project name
 * @returns Array of project files or empty array on error
 */
export async function getProjectFiles(projectName: string): Promise<ProjectFile[]> {
  try {
    const response = await api.projects.files(projectName);
    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    }
    return [];
  } catch (err) {
    logger.error('Failed to get project files:', err);
    return [];
  }
}

/**
 * Get project sessions
 *
 * @param projectName - Project name
 * @returns Array of project sessions or empty array on error
 */
export async function getProjectSessions(projectName: string): Promise<Session[]> {
  try {
    const response = await api.projects.sessions(projectName);
    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    }
    return [];
  } catch (err) {
    logger.error('Failed to get project sessions:', err);
    return [];
  }
}

/**
 * Create a new project via sidebar service
 */
export async function createProjectOperation(
  path: string,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): Promise<Project> {
  setError(null);
  try {
    return await getSidebarService().createProject(path);
  } catch (err) {
    // 重名冲突（409）：复用 i18n 友好文案，避免展示后端原始 message
    if ((err as { statusCode?: number }).statusCode === 409) {
      setError(i18n.t('projectCreation.error.nameExists'));
    } else {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
    }
    throw err;
  }
}

/**
 * Rename a project via sidebar service
 */
export async function renameProjectOperation(
  projectName: string,
  newName: string,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): Promise<void> {
  setError(null);
  try {
    await getSidebarService().renameProject(projectName, newName);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to rename project';
    setError(errorMessage);
    throw err;
  }
}

/**
 * Delete a project via sidebar service
 */
export async function deleteProjectOperation(
  projectName: string,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): Promise<void> {
  setError(null);
  try {
    await getSidebarService().deleteProject(projectName);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
    setError(errorMessage);
    throw err;
  }
}
