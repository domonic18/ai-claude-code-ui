/**
 * 会话查找与项目比较工具函数
 *
 * 提供跨 provider（Claude/Cursor/Codex）的会话查找、
 * 项目变更检测等共享工具函数，供多个 hooks 使用。
 *
 * @module features/system/hooks/useProjectUtils
 */

import type { Project } from '@/features/sidebar/types/sidebar.types';

/**
 * Check if projects have changed
 * 用于优化 React 状态更新，避免不必要的重渲染
 */
export function hasProjectsChanged(
  prevProjects: Project[],
  newProjects: Project[]
): boolean {
  if (prevProjects.length !== newProjects.length) {
    return true;
  }

  return newProjects.some((newProject: Project, index: number) => {
    const prevProject = prevProjects[index];
    if (!prevProject) return true;

    return (
      newProject.name !== prevProject.name ||
      newProject.displayName !== prevProject.displayName ||
      newProject.fullPath !== prevProject.fullPath ||
      JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
      JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions) ||
      JSON.stringify((newProject as any).cursorSessions) !== JSON.stringify((prevProject as any).cursorSessions)
    );
  });
}

/**
 * Find a session by ID across all providers in projects
 */
export function findSessionInProjects(
  projects: Project[],
  sessionId: string
): { project: Project; session: any; provider: 'claude' | 'cursor' | 'codex' } | null {
  for (const project of projects) {
    // Search in Claude sessions
    const claudeSession = project.sessions?.find(s => s.id === sessionId);
    if (claudeSession) {
      return { project, session: claudeSession, provider: 'claude' };
    }

    // Search in Cursor sessions
    const cursorSession = (project as any).cursorSessions?.find((s: any) => s.id === sessionId);
    if (cursorSession) {
      return { project, session: cursorSession, provider: 'cursor' };
    }

    // Search in Codex sessions
    const codexSession = (project as any).codexSessions?.find((s: any) => s.id === sessionId);
    if (codexSession) {
      return { project, session: codexSession, provider: 'codex' };
    }
  }
  return null;
}

/**
 * 从 API 响应中解析项目数据
 * @param responseData - API 响应数据
 * @returns 项目数组
 */
export function parseProjectsResponse(responseData: any): Project[] {
  if (responseData && typeof responseData === 'object') {
    if (Array.isArray(responseData.data)) {
      return responseData.data;
    } else if (Array.isArray(responseData.projects)) {
      return responseData.projects;
    } else if (Array.isArray(responseData)) {
      return responseData;
    }
  }
  return [];
}
