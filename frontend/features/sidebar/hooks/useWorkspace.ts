/**
 * useWorkspace Hook
 *
 * Hook for workspace management: create workspaces and manage projects within them.
 */

import { useCallback } from 'react';
import { api } from '@/shared/services';
import type { Project, WorkspaceCreationOptions } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';
import { useProject } from './useProject';

/**
 * Hook for workspace management
 */
export interface UseWorkspaceReturn {
  createWorkspace: (options: WorkspaceCreationOptions) => Promise<Project | null>;
  addProjectToWorkspace: (workspace: Project, projectPath: string) => Promise<void>;
  removeProjectFromWorkspace: (workspace: Project, projectPath: string) => Promise<void>;
  getWorkspaceProjects: (workspace: Project) => Promise<Project[]>;
}

export function useWorkspace(): UseWorkspaceReturn {
  const { createProject } = useProject();

  const createWorkspace = useCallback(async (options: WorkspaceCreationOptions): Promise<Project | null> => {
    return createProject(options);
  }, [createProject]);

  const addProjectToWorkspace = useCallback(async (workspace: Project, projectPath: string) => {
    try {
      const response = await api.projects.addProjectToWorkspace(workspace.name, projectPath);
      if (!response.ok) {
        throw new Error('Failed to add project to workspace');
      }
    } catch (err) {
      logger.error('Failed to add project to workspace:', err);
      throw err;
    }
  }, []);

  const removeProjectFromWorkspace = useCallback(async (workspace: Project, projectPath: string) => {
    try {
      const response = await api.projects.removeProjectFromWorkspace(workspace.name, projectPath);
      if (!response.ok) {
        throw new Error('Failed to remove project from workspace');
      }
    } catch (err) {
      logger.error('Failed to remove project from workspace:', err);
      throw err;
    }
  }, []);

  const getWorkspaceProjects = useCallback(async (workspace: Project): Promise<Project[]> => {
    try {
      const response = await api.projects.getWorkspaceProjects(workspace.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      logger.error('Failed to get workspace projects:', err);
      return [];
    }
  }, []);

  return {
    createWorkspace,
    addProjectToWorkspace,
    removeProjectFromWorkspace,
    getWorkspaceProjects,
  };
}
