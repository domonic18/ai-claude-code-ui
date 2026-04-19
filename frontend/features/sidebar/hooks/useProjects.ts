/**
 * useProjects Hook
 *
 * Custom hook for managing project data and operations.
 * Handles project fetching, creation, renaming, and deletion.
 *
 * ## Features
 * - Project list state management
 * - Loading states
 * - Error handling
 * - Automatic refresh on changes
 *
 * ## 数据流说明
 * 此 Hook 主要用于 Sidebar 内部的项目操作（创建、重命名、删除）。
 * 项目数据主要由父组件 (App.tsx → useProjectManager) 提供。
 *
 * ## 调用时序
 * 1. Sidebar 组件挂载 → useProjects(propProjects) 初始化
 * 2. propProjects 变化时 → useEffect 同步到内部 state
 * 3. 用户操作（创建/重命名/删除）→ 调用 service → 刷新列表
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getSidebarService } from '../services';
import { requestDeduplicator } from '@/shared/utils';
import type { Project } from '../types';
import type { ProjectSortOrder, StarredProjects } from '../types';
import { logger } from '@/shared/utils/logger';
import { sortProjectsByOrder, loadSortOrder, saveSortOrder } from '../helpers/projectSortHelpers';
import { createProjectOperation, renameProjectOperation, deleteProjectOperation } from '../helpers/projectApiHelpers';

/**
 * Hook return type
 */
export interface UseProjectsReturn {
  /** List of all projects */
  projects: Project[];
  /** Whether currently loading projects */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Sort order for projects */
  sortOrder: ProjectSortOrder;
  /** Set sort order */
  setSortOrder: (order: ProjectSortOrder) => void;
  /** Refresh project list */
  refresh: () => Promise<void>;
  /** Create a new project */
  createProject: (path: string) => Promise<Project>;
  /** Rename a project */
  renameProject: (projectName: string, newName: string) => Promise<void>;
  /** Delete a project */
  deleteProject: (projectName: string) => Promise<void>;
  /** Update session summary locally (optimistic update) */
  updateSessionSummary: (projectName: string, sessionId: string, newSummary: string) => void;
  /** Get sorted projects */
  getSortedProjects: (starredProjects: StarredProjects) => Project[];
}

/**
 * useProjects Hook
 */
export function useProjects(initialProjects?: Project[] | null): UseProjectsReturn {
  const safeInitialProjects = Array.isArray(initialProjects) ? initialProjects : [];
  const [projects, setProjects] = useState<Project[]>(safeInitialProjects);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrderState] = useState<ProjectSortOrder>(loadSortOrder);
  const service = getSidebarService();

  // Sync sort order on mount
  useEffect(() => { setSortOrderState(loadSortOrder()); }, []);

  // Sync projects from props when reference changes
  const prevProjectsRef = useRef<Project[] | null>(null);
  useEffect(() => {
    if (initialProjects && initialProjects !== prevProjectsRef.current) {
      const arr = Array.isArray(initialProjects) ? initialProjects : [];
      logger.info('[useProjects] Syncing projects from props:', arr);
      setProjects(arr); prevProjectsRef.current = arr;
    }
  }, [initialProjects]);

  const setSortOrder = useCallback((order: ProjectSortOrder) => {
    setSortOrderState(order); saveSortOrder(order);
  }, []);

  // Fetch/refresh projects (fallback when no parent onRefresh provided)
  const refresh = useCallback(async () => {
    return requestDeduplicator.dedupe('sidebar:refresh', async () => {
      setIsLoading(true);
      setError(null);
      try {
        setProjects(await service.getProjects());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        logger.error('Error fetching projects:', err);
      } finally { setIsLoading(false); }
    });
  }, [service]);

  const createProject = useCallback(async (path: string): Promise<Project> => {
    const p = await createProjectOperation(path, setError);
    await refresh(); return p;
  }, [refresh]);

  const renameProject = useCallback(async (projectName: string, newName: string) => {
    await renameProjectOperation(projectName, newName, setError);
    setProjects(prev => prev.map(p => p.name === projectName ? { ...p, displayName: newName } : p));
  }, []);

  const deleteProject = useCallback(async (projectName: string) => {
    await deleteProjectOperation(projectName, setError);
    setProjects(prev => prev.filter(p => p.name !== projectName));
  }, []);

  const updateSessionSummary = useCallback((projectName: string, sessionId: string, newSummary: string) => {
    const updateArr = (arr: any[] | undefined) =>
      arr ? arr.map(s => (s.id === sessionId ? { ...s, summary: newSummary } : s)) : arr;
    setProjects(prev => prev.map(p => p.name !== projectName ? p : { ...p,
      sessions: updateArr(p.sessions), cursorSessions: updateArr(p.cursorSessions), codexSessions: updateArr(p.codexSessions) }));
  }, []);

  const getSortedProjects = useCallback((starredProjects: StarredProjects): Project[] => {
    return sortProjectsByOrder(Array.isArray(projects) ? projects : [], sortOrder, starredProjects);
  }, [projects, sortOrder]);

  return { projects, isLoading, error, sortOrder, setSortOrder, refresh,
    createProject, renameProject, deleteProject, updateSessionSummary, getSortedProjects };
}

export default useProjects;
