/**
 * useAppDataSync.ts
 *
 * App-level data synchronization hooks
 * Extracted from App.tsx to reduce complexity
 */

import { useEffect } from 'react';
import type { Project } from '@/features/sidebar/types/sidebar.types';

interface WebSocketMessage {
  type: string;
  projects?: Project[];
  changedFile?: string;
}

/**
 * Handle WebSocket project updates and external session changes
 */
function useWebSocketProjectUpdates(
  messages: any[],
  selectedProject: any,
  selectedSession: any,
  activeSessions: Set<string>,
  shouldSkipUpdate: (projects: Project[], updatedProjects: Project[]) => boolean,
  updateProjectsFromWebSocket: (projects: Project[]) => void,
  incrementExternalMessageUpdate: () => void,
  projects: Project[]
) {
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1] as WebSocketMessage;
    if (latestMessage.type !== 'projects_updated') return;

    if (latestMessage.changedFile && selectedSession && selectedProject) {
      const normalized = latestMessage.changedFile.replace(/\\/g, '/');
      const parts = normalized.split('/');
      if (parts.length >= 2) {
        const changedSessionId = parts[parts.length - 1].replace('.jsonl', '');
        if (changedSessionId === selectedSession.id && !activeSessions.has(selectedSession.id)) {
          incrementExternalMessageUpdate();
        }
      }
    }

    const updatedProjects = latestMessage.projects || [];
    if (updatedProjects.length > 0 && !shouldSkipUpdate(projects, updatedProjects)) {
      updateProjectsFromWebSocket(updatedProjects);
    }
  }, [messages, selectedProject, selectedSession, shouldSkipUpdate, updateProjectsFromWebSocket, projects, activeSessions, incrementExternalMessageUpdate]);
}

/**
 * Manage app data fetching and synchronization
 */
export function useAppDataSync(
  user: any,
  layout: any,
  activeSessions: Set<string>,
  fetchProjects: () => void,
  selectedSession: any,
  messages: any[],
  selectedProject: any,
  shouldSkipUpdate: (projects: Project[], updatedProjects: Project[]) => boolean,
  updateProjectsFromWebSocket: (projects: Project[]) => void,
  incrementExternalMessageUpdate: () => void,
  projects: Project[]
) {
  useEffect(() => {
    if (!layout.autoRefreshInterval || layout.autoRefreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      if (activeSessions.size === 0) fetchProjects();
    }, layout.autoRefreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [layout.autoRefreshInterval, activeSessions, fetchProjects]);

  useWebSocketProjectUpdates(
    messages, selectedProject, selectedSession, activeSessions,
    shouldSkipUpdate, updateProjectsFromWebSocket, incrementExternalMessageUpdate, projects
  );

  useEffect(() => {
    if (selectedSession) layout.setActiveTab('chat');
  }, [selectedSession?.id, layout]);
}
