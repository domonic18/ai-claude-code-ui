/**
 * useProjectSync.ts
 *
 * 项目同步辅助函数 — 从 useProjects.ts 提取
 * 负责初始会话选择和刷新后的会话同步
 *
 * @module features/system/hooks/useProjectSync
 */

import type { Project } from '@/features/sidebar/types/sidebar.types';
import type { Session, ProjectManagerConfig } from '../types/projectManagement.types';

/**
 * 首次获取项目后的初始会话选择
 */
export function performInitialSessionSelection(
  data: Project[],
  deps: {
    selectedProjectRef: React.MutableRefObject<Project | null>;
    selectedSessionRef: React.MutableRefObject<Session | null>;
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
    restoreLastSession: (projects: Project[], setSelectedProject: (project: Project) => void) => boolean;
    setNewSessionCounter: React.Dispatch<React.SetStateAction<number>>;
  }
) {
  const restored = deps.restoreLastSession(data, deps.setSelectedProject);

  if (!restored) {
    const firstProject = data[0];
    const firstSession = firstProject.sessions?.[0] ||
                        (firstProject as any).cursorSessions?.[0] ||
                        (firstProject as any).codexSessions?.[0];

    deps.setSelectedProject(firstProject);

    if (firstSession) {
      const provider = firstProject.sessions?.some(s => s.id === firstSession.id) ? 'claude' :
                      (firstProject as any).cursorSessions?.some((s: any) => s.id === firstSession.id) ? 'cursor' : 'codex';
      deps.setSelectedSession({
        ...firstSession,
        __projectName: firstProject.name,
        __provider: provider
      });
    } else {
      deps.setSelectedSession(null);
      deps.setNewSessionCounter(prev => prev + 1);
    }
  }
}

/**
 * 刷新后同步选中的项目和会话
 */
export function syncSessionAfterRefresh(
  currentProject: Project | null,
  currentSession: Session | null,
  freshProjects: Project[],
  deps: {
    setSelectedProject: (project: Project | null) => void;
    setSelectedSession: (session: Session | null) => void;
  }
) {
  if (!currentProject) return;

  const refreshedProject = freshProjects.find((p: Project) => p.name === currentProject.name);
  if (!refreshedProject) return;

  if (JSON.stringify(refreshedProject) !== JSON.stringify(currentProject)) {
    deps.setSelectedProject(refreshedProject);
  }

  if (!currentSession) return;

  const allSessions = [
    ...(refreshedProject.sessions || []),
    ...((refreshedProject as any).cursorSessions || []),
    ...((refreshedProject as any).codexSessions || [])
  ];
  const refreshedSession = allSessions.find(s => s.id === currentSession.id);
  if (refreshedSession) {
    const hasSessionChanges =
      (refreshedSession as any).summary !== (currentSession as any).summary ||
      (refreshedSession as any).title !== (currentSession as any).title;

    if (hasSessionChanges) {
      deps.setSelectedSession({
        ...refreshedSession,
        __projectName: refreshedProject.name,
        __provider: currentSession.__provider
      } as Session);
    }
  }
}
