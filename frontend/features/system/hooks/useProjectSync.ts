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
  // 新建会话保护：用户已选中项目但会话为空（点 + 新建、等待首条消息）时，
  // 跳过自动恢复/兜底选中——否则轮询 fetch 返回会把用户刚清掉的旧会话
  //（lastSessionId 恢复或"第一个会话"兜底）重新选回来，覆盖新建意图
  if (deps.selectedProjectRef.current && !deps.selectedSessionRef.current) {
    return;
  }

  const restored = deps.restoreLastSession(data, deps.setSelectedProject);

  if (!restored) {
    // 一次性"新建未聊"标记（点 + 后未聊任何消息就刷新）：恢复为对应模式的空白新会话，
    // 不兜底选中第一个会话。消费即清除——下次无标记时恢复默认冷启动行为
    //（选中第一个会话），避免用户永久困在空白新建界面
    let newSessionMode: string | null = null;
    try {
      newSessionMode = localStorage.getItem('new-session-mode');
      if (newSessionMode) localStorage.removeItem('new-session-mode');
    } catch {
      // localStorage 不可用时按默认逻辑
    }
    if (newSessionMode === 'direct' || newSessionMode === 'claude') {
      try {
        // 直连模式标记与一次性标记同步（direct-mode 供 ChatInterface 挂载时读取）
        if (newSessionMode === 'direct') localStorage.setItem('direct-mode', 'true');
        else localStorage.removeItem('direct-mode');
      } catch {
        // 静默
      }
      deps.setSelectedProject(data[0]);
      deps.setSelectedSession(null);
      deps.setNewSessionCounter(prev => prev + 1);
      return;
    }

    const firstProject = data[0];
    const firstSession = firstProject.sessions?.[0] ||
                        (firstProject as any).cursorSessions?.[0] ||
                        (firstProject as any).codexSessions?.[0];

    deps.setSelectedProject(firstProject);

    if (firstSession) {
      // 直连会话与 Claude 会话同数组，靠后端透传的 provider 字段区分
      const inClaudeArray = firstProject.sessions?.find(s => s.id === firstSession.id);
      const provider = inClaudeArray
        ? ((inClaudeArray as any).provider === 'direct' ? 'direct' : 'claude')
        : (firstProject as any).cursorSessions?.some((s: any) => s.id === firstSession.id) ? 'cursor' : 'codex';
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
  } else {
    // 会话在最新数据中已不存在（被删除）：清空选中态，避免残留 stale sessionId
    // 触发 useSessionSync 清空 currentSessionId / messages。
    deps.setSelectedSession(null);
  }
}
