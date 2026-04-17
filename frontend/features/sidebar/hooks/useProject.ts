/**
 * useProject Hook
 *
 * Hook for core project CRUD operations: list, create, delete, rename.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/shared/services';
import type {
  Project,
  ProjectCreationOptions,
  ProjectFile,
  Session,
} from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Hook for project management functionality
 */
export interface UseProjectReturn {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (options: ProjectCreationOptions) => Promise<Project | null>;
  deleteProject: (project: Project) => Promise<void>;
  renameProject: (project: Project, displayName: string) => Promise<void>;
  getProjectFiles: (project: Project) => Promise<ProjectFile[]>;
  getProjectSessions: (project: Project) => Promise<Session[]>;
}

/**
 * Hook for managing projects
 */
export function useProject(): UseProjectReturn {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refresh projects list
   */
  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.list();
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data || []);
      } else {
        throw new Error('Failed to fetch projects');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to refresh projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new project
   */
  const createProject = useCallback(async (options: ProjectCreationOptions): Promise<Project | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.create(options);
      if (response.ok) {
        const data = await response.json();
        const newProject = data.data as Project;

        // Add to projects list
        setProjects(prev => [...prev, newProject]);

        // Set as current project
        setCurrentProject(newProject);

        return newProject;
      } else {
        const data = await response.json().catch(() => ({ error: 'Failed to create project' }));
        setError(data.error || 'Failed to create project');
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to create project:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a project
   */
  const deleteProject = useCallback(async (project: Project) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.delete(project.name);
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Remove from projects list
      setProjects(prev => prev.filter(p => p.name !== project.name));

      // Clear current project if it was deleted
      if (currentProject?.name === project.name) {
        setCurrentProject(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to delete project:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  /**
   * Rename a project
   */
  const renameProject = useCallback(async (project: Project, displayName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.rename(project.name, displayName);
      if (!response.ok) {
        throw new Error('Failed to rename project');
      }

      // Update in projects list
      setProjects(prev => prev.map(p =>
        p.name === project.name
          ? { ...p, displayName }
          : p
      ));

      // Update current project if it was renamed
      if (currentProject?.name === project.name) {
        setCurrentProject(prev => prev ? { ...prev, displayName } : null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to rename project:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  /**
   * Get project files
   */
  const getProjectFiles = useCallback(async (project: Project): Promise<ProjectFile[]> => {
    try {
      const response = await api.projects.files(project.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      logger.error('Failed to get project files:', err);
      return [];
    }
  }, []);

  /**
   * Get project sessions
   */
  const getProjectSessions = useCallback(async (project: Project): Promise<Session[]> => {
    try {
      const response = await api.projects.sessions(project.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      logger.error('Failed to get project sessions:', err);
      return [];
    }
  }, []);

  /**
   * Load projects on mount
   */
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return {
    currentProject,
    projects,
    isLoading,
    error,
    setCurrentProject,
    refreshProjects,
    createProject,
    deleteProject,
    renameProject,
    getProjectFiles,
    getProjectSessions,
  };
}
