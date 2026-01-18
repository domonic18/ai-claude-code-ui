/**
 * Project Hooks
 *
 * Custom hooks for project management functionality.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/shared/services';
import type {
  Project,
  ProjectCreationOptions,
  WorkspaceCreationOptions,
  ProjectFile,
  Session,
} from '../types';

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
      const response = await api.project.list();
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data || []);
      } else {
        throw new Error('Failed to fetch projects');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to refresh projects:', err);
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
      const response = await api.project.create(options);
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
      console.error('Failed to create project:', err);
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
      const response = await api.project.delete(project.name);
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
      console.error('Failed to delete project:', err);
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
      const response = await api.project.rename(project.name, displayName);
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
      console.error('Failed to rename project:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  /**
   * Get project files
   */
  const getProjectFiles = useCallback(async (project: Project): Promise<ProjectFile[]> => {
    try {
      const response = await api.project.files(project.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      console.error('Failed to get project files:', err);
      return [];
    }
  }, []);

  /**
   * Get project sessions
   */
  const getProjectSessions = useCallback(async (project: Project): Promise<Session[]> => {
    try {
      const response = await api.project.sessions(project.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      console.error('Failed to get project sessions:', err);
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

/**
 * Hook for project files
 */
export interface UseProjectFilesReturn {
  files: ProjectFile[];
  isLoading: boolean;
  error: string | null;
  refreshFiles: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
}

export function useProjectFiles(project: Project | null): UseProjectFilesReturn {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    if (!project) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.files(project.name);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.data || []);
      } else {
        throw new Error('Failed to fetch files');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to refresh files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const createFile = useCallback(async (path: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.createFile(project.name, path);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to create file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to create file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  const deleteFile = useCallback(async (path: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.deleteFile(project.name, path);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to delete file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.renameFile(project.name, oldPath, newPath);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to rename file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to rename file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  useEffect(() => {
    refreshFiles();
  }, [project, refreshFiles]);

  return {
    files,
    isLoading,
    error,
    refreshFiles,
    createFile,
    deleteFile,
    renameFile,
  };
}

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
      const response = await api.project.addProjectToWorkspace(workspace.name, projectPath);
      if (!response.ok) {
        throw new Error('Failed to add project to workspace');
      }
    } catch (err) {
      console.error('Failed to add project to workspace:', err);
      throw err;
    }
  }, []);

  const removeProjectFromWorkspace = useCallback(async (workspace: Project, projectPath: string) => {
    try {
      const response = await api.project.removeProjectFromWorkspace(workspace.name, projectPath);
      if (!response.ok) {
        throw new Error('Failed to remove project from workspace');
      }
    } catch (err) {
      console.error('Failed to remove project from workspace:', err);
      throw err;
    }
  }, []);

  const getWorkspaceProjects = useCallback(async (workspace: Project): Promise<Project[]> => {
    try {
      const response = await api.project.getWorkspaceProjects(workspace.name);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    } catch (err) {
      console.error('Failed to get workspace projects:', err);
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

/**
 * Hook for project sessions
 */
export interface UseProjectSessionsReturn {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
}

export function useProjectSessions(project: Project | null): UseProjectSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    if (!project) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.sessions(project.name);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
      } else {
        throw new Error('Failed to fetch sessions');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to refresh sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.project.deleteSession(project.name, sessionId);
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to delete session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const resumeSession = useCallback(async (sessionId: string) => {
    if (!project) return;

    try {
      await api.project.resumeSession(project.name, sessionId);
    } catch (err) {
      console.error('Failed to resume session:', err);
      throw err;
    }
  }, [project]);

  useEffect(() => {
    refreshSessions();
  }, [project, refreshSessions]);

  return {
    sessions,
    isLoading,
    error,
    refreshSessions,
    deleteSession,
    resumeSession,
  };
}
