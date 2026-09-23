/**
 * 项目数据获取 Hook
 *
 * 管理项目列表的获取、刷新、WebSocket 更新等数据层操作。
 * 从 useProjectManager 中提取，职责单一：项目数据的 CRUD。
 *
 * @module features/system/hooks/useProjects
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session, ProjectManagerConfig } from '../types/projectManagement.types';
import {
  executeFetchProjects,
  executeSidebarRefresh,
  executeWebSocketUpdate
} from './useProjectActions';
import { logger } from '@/shared/utils/logger';

// 由组件调用，自定义 Hook：useProjects
/**
 * Projects data hook
 *
 * Manages project fetching, refreshing, and WebSocket updates.
 */
export function useProjects(
  user: { id: string } | null,
  config: ProjectManagerConfig = {},
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    handleSessionSelect: (session: Session, projectName?: string, selectedProjectRef?: React.RefObject<Project | null>) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  }
) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const projectsRef = useRef<Project[]>([]);
  const hasFetchedRef = useRef<boolean>(false);
  const hasInitialSyncRef = useRef<boolean>(false);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const fetchProjects = useCallback(async (isRetry = false, retryCount = 0) => {
    return executeFetchProjects(user, setIsLoadingProjects, setProjects, hasInitialSyncRef, deps, isRetry, retryCount);
  }, [user, deps]);

  const handleSidebarRefresh = useCallback(async (options?: { force?: boolean }) => {
    return executeSidebarRefresh(setProjects, deps, options);
  }, [deps]);

  const updateProjectsFromWebSocket = useCallback((updatedProjects: Project[]) => {
    return executeWebSocketUpdate(updatedProjects, setProjects, deps);
  }, [deps]);

  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (prevUserIdRef.current !== currentUserId) {
      logger.info('[useProjects] User changed, resetting fetch state');
      hasFetchedRef.current = false;
      hasInitialSyncRef.current = false;
      prevUserIdRef.current = currentUserId;
    }

    if (user && !hasFetchedRef.current) {
      logger.info('[useProjects] User logged in, fetching projects...');
      hasFetchedRef.current = true;
      fetchProjects();
    }
  }, [user, fetchProjects]);

  useEffect(() => {
    (window as any).refreshProjects = fetchProjects;
    // 静默刷新：会话完成后的后台对齐用。与 refreshProjects 唯一差异是
    // isRetry=true 分支——不置 isLoadingProjects，侧边栏不闪 loading
    // skeleton，数据到了悄悄替换
    (window as any).refreshProjectsSilent = () => fetchProjects(true);
    // 即时置顶：发消息瞬间本地把该项目 lastActivity 置为 now（不发请求、
    // 不闪 loading），最近活动排序随重渲染立即把它移到顶部；会话完成后
    // 的静默刷新拿到真实数据自然对齐
    (window as any).touchProjectLocally = (projectName: string) => {
      setProjects(prev => prev.map(p =>
        p.name === projectName ? { ...p, lastActivity: new Date().toISOString() } : p
      ));
    };
  }, [fetchProjects]);

  return {
    projects,
    setProjects,
    isLoadingProjects,
    projectsRef,
    fetchProjects,
    handleSidebarRefresh,
    updateProjectsFromWebSocket,
  };
}
