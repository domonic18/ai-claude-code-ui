/*
 * App.tsx - Main Application Component with Session Protection System
 *
 * SESSION PROTECTION SYSTEM OVERVIEW:
 * ===================================
 *
 * Problem: Automatic project updates from WebSocket would refresh the sidebar and clear chat messages
 * during active conversations, creating a poor user experience.
 *
 * Solution: Track "active sessions" and pause project updates during conversations.
 *
 * How it works:
 * 1. When user sends message → session marked as "active"
 * 2. Project updates are skipped while session is active
 * 3. When conversation completes/aborts → session marked as "inactive"
 * 4. Project updates resume normally
 *
 * Handles both existing sessions (with real IDs) and new sessions (with temporary IDs).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { Sidebar } from './features/sidebar/components';
import MainContent from '@/shared/components/layout/MainContent';
import MobileNav from '@/shared/components/layout/MobileNav';
import { Settings } from './features/settings/components';
import { QuickSettingsPanel } from '@/features/settings';

import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/shared/contexts/AuthContext';
import { TaskMasterProvider } from '@/shared/contexts/TaskMasterContext';
import { TasksSettingsProvider } from '@/shared/contexts/TasksSettingsContext';
import { WebSocketProvider, useWebSocketContext } from '@/shared/contexts/WebSocketContext';
import { ProtectedRoute } from '@/router';
import { useVersionCheck } from '@/shared/hooks/useVersionCheck';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { api, authenticatedFetch } from '@/shared/services';
import type { Project, Session as SidebarSession } from './features/sidebar/types/sidebar.types';
import type { SettingsTab } from './features/settings/types/settings.types';

// Local type definitions (API response format)
interface ApiSession {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  __provider?: 'claude' | 'cursor' | 'codex';
  __projectName?: string;
}

// Type alias for Session - use ApiSession internally but cast to SidebarSession when passing to Sidebar
type Session = ApiSession;

interface ReleaseInfo {
  title: string;
  body: string;
  htmlUrl: string;
}

interface WebSocketMessage {
  type: string;
  projects?: Project[];
  changedFile?: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
}

// Main App component with routing
function AppContent() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { user } = useAuth();

  const { updateAvailable, latestVersion, currentVersion, releaseInfo } = useVersionCheck('siteboon', 'claudecodeui');
  const [showVersionModal, setShowVersionModal] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('agents');
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [autoExpandTools, setAutoExpandTools] = useLocalStorage('autoExpandTools', false);
  const [showRawParameters, setShowRawParameters] = useLocalStorage('showRawParameters', false);
  const [showThinking, setShowThinking] = useLocalStorage('showThinking', true);
  const [autoScrollToBottom, setAutoScrollToBottom] = useLocalStorage('autoScrollToBottom', true);
  const [sendByCtrlEnter, setSendByCtrlEnter] = useLocalStorage('sendByCtrlEnter', false);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', true);
  const [autoRefreshInterval] = useLocalStorage('autoRefreshInterval', 0);

  // Session Protection System: Track sessions with active conversations
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const [processingSessions, setProcessingSessions] = useState<Set<string>>(new Set());
  const [externalMessageUpdate, setExternalMessageUpdate] = useState(0);

  const { ws, sendMessage, messages } = useWebSocketContext();

  // Detect if running as PWA
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
      // Enable touch action for PWA
      document.addEventListener('touchstart', () => {}, { passive: true });

      if (isStandalone) {
        document.documentElement.classList.add('pwa-mode');
        document.body.classList.add('pwa-mode');
      } else {
        document.documentElement.classList.remove('pwa-mode');
        document.body.classList.remove('pwa-mode');
      }
    };

    checkPWA();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWA);

    return () => {
      mediaQuery.removeEventListener('change', checkPWA);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch projects when user logs in
  useEffect(() => {
    if (user) {
      console.log('[App] User logged in, fetching projects...');
      fetchProjects();
    }
  }, [user]);

  // Auto-refresh projects periodically
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) {
      return;
    }

    console.log(`[App] Auto-refresh enabled: checking for new projects every ${autoRefreshInterval} seconds`);

    const intervalId = setInterval(() => {
      if (activeSessions.size === 0) {
        console.log('[App] Auto-refreshing projects...');
        fetchProjects();
      } else {
        console.log('[App] Skipping auto-refresh: active session detected');
      }
    }, (autoRefreshInterval as number) * 1000);

    return () => {
      clearInterval(intervalId);
      console.log('[App] Auto-refresh stopped');
    };
  }, [autoRefreshInterval, activeSessions]);

  // Helper function to determine if an update is purely additive
  const isUpdateAdditive = (
    currentProjects: Project[],
    updatedProjects: Project[],
    selectedProject: Project | null,
    selectedSession: Session | null
  ): boolean => {
    if (!selectedProject || !selectedSession) {
      return true;
    }

    const currentSelectedProject = currentProjects?.find(p => p.name === selectedProject.name);
    const updatedSelectedProject = updatedProjects?.find(p => p.name === selectedProject.name);

    if (!currentSelectedProject || !updatedSelectedProject) {
      return false;
    }

    const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === selectedSession.id) as Session | undefined;
    const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id) as Session | undefined;

    if (!currentSelectedSession || !updatedSelectedSession) {
      return false;
    }

    const sessionUnchanged =
      currentSelectedSession.id === updatedSelectedSession.id &&
      currentSelectedSession.title === updatedSelectedSession.title &&
      currentSelectedSession.created_at === updatedSelectedSession.created_at &&
      currentSelectedSession.updated_at === updatedSelectedSession.updated_at;

    return sessionUnchanged;
  };

  // Handle WebSocket messages for real-time project updates
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1] as WebSocketMessage;

      if (latestMessage.type === 'projects_updated') {
        // External Session Update Detection
        if (latestMessage.changedFile && selectedSession && selectedProject) {
          const normalized = latestMessage.changedFile.replace(/\\/g, '/');
          const changedFileParts = normalized.split('/');

          if (changedFileParts.length >= 2) {
            const filename = changedFileParts[changedFileParts.length - 1];
            const changedSessionId = filename.replace('.jsonl', '');

            if (changedSessionId === selectedSession.id) {
              const isSessionActive = activeSessions.has(selectedSession.id);

              if (!isSessionActive) {
                setExternalMessageUpdate(prev => prev + 1);
              }
            }
          }
        }

        // Session Protection Logic
        const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                                 (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));

        if (hasActiveSession) {
          const updatedProjects = latestMessage.projects || [];
          const currentProjects = projects;

          const isAdditiveUpdate = isUpdateAdditive(currentProjects, updatedProjects, selectedProject, selectedSession);

          if (!isAdditiveUpdate) {
            return;
          }
        }

        const updatedProjects = latestMessage.projects || [];
        setProjects(updatedProjects);

        if (selectedProject) {
          const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
          if (updatedSelectedProject) {
            if (JSON.stringify(updatedSelectedProject) !== JSON.stringify(selectedProject)) {
              setSelectedProject(updatedSelectedProject);
            }

            if (selectedSession) {
              const allSessions = [
                ...(updatedSelectedProject.sessions || []),
                ...(updatedSelectedProject.codexSessions || []),
                ...(updatedSelectedProject.cursorSessions || [])
              ];
              const updatedSelectedSession = allSessions.find(s => s.id === selectedSession.id);
              if (!updatedSelectedSession) {
                setSelectedSession(null);
              }
            }
          }
        }
      }
    }
  }, [messages, selectedProject, selectedSession, activeSessions]);

  const fetchProjects = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setIsLoadingProjects(true);
      }
      const response = await api.projects();

      if (!response.ok) {
        console.error('Failed to fetch projects:', response.status, response.statusText);
        setProjects([]);
        return;
      }

      const responseData = await response.json();
      const data = responseData.data;

      if (!isRetry && data.length === 0 && user) {
        console.log('[App] No projects found, container may be initializing. Scheduling retry...');
        setTimeout(() => {
          console.log('[App] Retrying project fetch...');
          fetchProjects(true);
        }, 2000);
        return;
      }

      // Always fetch Cursor sessions for each project
      for (let project of data) {
        try {
          const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || project.path || '')}`;
          const cursorResponse = await authenticatedFetch(url);
          if (cursorResponse.ok) {
            const cursorData = await cursorResponse.json();
            if (cursorData.success && cursorData.sessions) {
              (project as any).cursorSessions = cursorData.sessions;
            } else {
              (project as any).cursorSessions = [];
            }
          } else {
            (project as any).cursorSessions = [];
          }
        } catch (error) {
          console.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
          (project as any).cursorSessions = [];
        }
      }

      setProjects(prevProjects => {
        if (prevProjects.length === 0) {
          return data;
        }

        const hasChanges = data.some((newProject: Project, index: number) => {
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
        }) || data.length !== prevProjects.length;

        return hasChanges ? data : prevProjects;
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Expose fetchProjects globally
  (window as any).refreshProjects = fetchProjects;

  // Expose openSettings function globally
  (window as any).openSettings = useCallback((tab: SettingsTab = 'agents') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  // Handle URL-based session loading
  useEffect(() => {
    if (sessionId && projects.length > 0) {
      const shouldSwitchTab = !selectedSession || selectedSession.id !== sessionId;
      for (const project of projects) {
        let session = project.sessions?.find(s => s.id === sessionId);
        if (session) {
          setSelectedProject(project);
          setSelectedSession({ ...session, __provider: 'claude' });
          if (shouldSwitchTab) {
            setActiveTab('chat');
          }
          return;
        }
        const cSession = project.cursorSessions?.find(s => s.id === sessionId);
        if (cSession) {
          setSelectedProject(project);
          setSelectedSession({ ...cSession, __provider: 'cursor' });
          if (shouldSwitchTab) {
            setActiveTab('chat');
          }
          return;
        }
      }
    }
  }, [sessionId, projects]);

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    if (activeTab !== 'git' && activeTab !== 'preview') {
      setActiveTab('chat');
    }

    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (provider === 'cursor') {
      sessionStorage.setItem('cursorSessionId', session.id);
    }

    if (isMobile) {
      const sessionProjectName = session.__projectName;
      const currentProjectName = selectedProject?.name;

      if (sessionProjectName !== currentProjectName) {
        setSidebarOpen(false);
      }
    }
    navigate(`/session/${session.id}`);
  };

  const handleNewSession = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    if (project) {
      setSelectedProject(project);
      setSelectedSession(null);
      setActiveTab('chat');
      navigate('/');
      if (isMobile) {
        setSidebarOpen(false);
      }
    }
  };

  const handleSessionDelete = (deletedSessionId: string) => {
    if (selectedSession?.id === deletedSessionId) {
      setSelectedSession(null);
      navigate('/');
    }

    setProjects(prevProjects =>
      prevProjects.map(project => ({
        ...project,
        sessions: project.sessions?.filter(session => session.id !== deletedSessionId) || [],
        sessionMeta: {
          ...project.sessionMeta,
          total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
        }
      }))
    );
  };

  const handleSidebarRefresh = async () => {
    try {
      const response = await api.projects();

      if (!response.ok) {
        console.error('Failed to refresh projects:', response.status, response.statusText);
        return;
      }

      const responseData = await response.json();
      const freshProjects = responseData.data ?? responseData;

      setProjects(prevProjects => {
        const hasChanges = freshProjects.some((newProject: Project, index: number) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;

          return (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath ||
            JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
            JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions)
          );
        }) || freshProjects.length !== prevProjects.length;

        return hasChanges ? freshProjects : prevProjects;
      });

      if (selectedProject) {
        const refreshedProject = freshProjects.find((p: Project) => p.name === selectedProject.name);
        if (refreshedProject) {
          if (JSON.stringify(refreshedProject) !== JSON.stringify(selectedProject)) {
            setSelectedProject(refreshedProject);
          }

          if (selectedSession) {
            const refreshedSession = refreshedProject.sessions?.find(s => s.id === selectedSession.id);
            if (refreshedSession && JSON.stringify(refreshedSession) !== JSON.stringify(selectedSession)) {
              setSelectedSession(refreshedSession);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing sidebar:', error);
    }
  };

  const handleProjectDelete = (projectName: string) => {
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      navigate('/');
    }

    setProjects(prevProjects =>
      prevProjects.filter(project => project.name !== projectName)
    );
  };

  // Session Protection Functions
  const markSessionAsActive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
    }
  }, []);

  const markSessionAsInactive = useCallback((sessionId: string) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  }, []);

  const markSessionAsProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => new Set([...prev, sessionId]));
    }
  }, []);

  const markSessionAsNotProcessing = useCallback((sessionId: string) => {
    if (sessionId) {
      setProcessingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  }, []);

  const replaceTemporarySession = useCallback(async (realSessionId: string) => {
    if (realSessionId) {
      setActiveSessions(prev => {
        const newSet = new Set<string>();
        for (const sessionId of prev) {
          if (!sessionId.startsWith('new-session-')) {
            newSet.add(sessionId);
          }
        }
        newSet.add(realSessionId);
        return newSet;
      });

      if (selectedProject && !selectedSession) {
        await handleSidebarRefresh();
        navigate(`/session/${realSessionId}`);
      }
    }
  }, [selectedProject, selectedSession, handleSidebarRefresh, navigate]);

  // Version Upgrade Modal Component
  const VersionUpgradeModal = () => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateOutput, setUpdateOutput] = useState('');
    const [updateError, setUpdateError] = useState('');

    if (!showVersionModal) return null;

    const cleanChangelog = (body: string | undefined): string => {
      if (!body) return '';

      return body
        .replace(/\b[0-9a-f]{40}\b/gi, '')
        .replace(/(?:^|\s|-)([0-9a-f]{7,10})\b/gi, '')
        .replace(/\*\*Full Changelog\*\*:.*$/gim, '')
        .replace(/https?:\/\/github\.com\/[^\/]+\/[^\/]+\/compare\/[^\s)]+/gi, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    };

    const handleUpdateNow = async () => {
      setIsUpdating(true);
      setUpdateOutput('Starting update...\n');
      setUpdateError('');

      try {
        const response = await authenticatedFetch('/api/system/update', {
          method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
          setUpdateOutput(prev => prev + data.output + '\n');
          setUpdateOutput(prev => prev + '\n✅ Update completed successfully!\n');
          setUpdateOutput(prev => prev + 'Please restart the server to apply changes.\n');
        } else {
          setUpdateError(data.error || 'Update failed');
          setUpdateOutput(prev => prev + '\n❌ Update failed: ' + (data.error || 'Unknown error') + '\n');
        }
      } catch (error: any) {
        setUpdateError(error.message);
        setUpdateOutput(prev => prev + '\n❌ Update failed: ' + error.message + '\n');
      } finally {
        setIsUpdating(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowVersionModal(false)}
          aria-label="Close version upgrade modal"
        />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Available</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {releaseInfo?.title || 'A new version is ready'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVersionModal(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Version</span>
              <span className="text-sm text-gray-900 dark:text-white font-mono">{currentVersion}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Latest Version</span>
              <span className="text-sm text-blue-900 dark:text-blue-100 font-mono">{latestVersion}</span>
            </div>
          </div>

          {releaseInfo?.body && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">What's New:</h3>
                {releaseInfo?.htmlUrl && (
                  <a
                    href={releaseInfo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
                  >
                    View full release
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                  {cleanChangelog(releaseInfo.body)}
                </div>
              </div>
            </div>
          )}

          {updateOutput && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Update Progress:</h3>
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 border border-gray-700 max-h-48 overflow-y-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{updateOutput}</pre>
              </div>
            </div>
          )}

          {!isUpdating && !updateOutput && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Manual upgrade:</h3>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border">
                <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                  git checkout main && git pull && npm install
                </code>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Or click "Update Now" to run the update automatically.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowVersionModal(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              {updateOutput ? 'Close' : 'Later'}
            </button>
            {!updateOutput && (
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('git checkout main && git pull && npm install');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Copy Command
                </button>
                <button
                  onClick={handleUpdateNow}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Now'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Fixed Desktop Sidebar */}
      {!isMobile && (
        <div
          className={`h-full flex-shrink-0 border-r border-border bg-card transition-all duration-300 ${
            sidebarVisible ? 'w-80' : 'w-14'
          }`}
        >
          <div className="h-full overflow-hidden">
            {sidebarVisible ? (
              <Sidebar
                projects={projects}
                selectedProject={selectedProject}
                selectedSession={selectedSession as SidebarSession | null}
                onProjectSelect={handleProjectSelect}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                onSessionDelete={handleSessionDelete}
                onProjectDelete={handleProjectDelete}
                isLoading={isLoadingProjects}
                onRefresh={handleSidebarRefresh}
                onShowSettings={() => setShowSettings(true)}
                updateAvailable={updateAvailable}
                latestVersion={latestVersion}
                currentVersion={currentVersion}
                releaseInfo={releaseInfo}
                onShowVersionModal={() => setShowVersionModal(true)}
                isPWA={isPWA}
                isMobile={isMobile}
                onToggleSidebar={() => setSidebarVisible(false)}
              />
            ) : (
              <div className="h-full flex flex-col items-center py-4 gap-4">
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200 group"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <svg
                    className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-accent rounded-md transition-colors duration-200"
                  aria-label="Settings"
                  title="Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>

                {updateAvailable && (
                  <button
                    onClick={() => setShowVersionModal(true)}
                    className="relative p-2 hover:bg-accent rounded-md transition-colors duration-200"
                    aria-label="Update available"
                    title="Update available"
                  >
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${
          sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
          <button
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-150 ease-out"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            aria-label="Close sidebar"
          />
          <div
            className={`relative w-[85vw] max-w-sm sm:w-80 h-full bg-card border-r border-border transform transition-transform duration-150 ease-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession as SidebarSession | null}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowSettings(true)}
              updateAvailable={updateAvailable}
              latestVersion={latestVersion}
              currentVersion={currentVersion}
              releaseInfo={releaseInfo}
              onShowVersionModal={() => setShowVersionModal(true)}
              isPWA={isPWA}
              isMobile={isMobile}
              onToggleSidebar={() => setSidebarVisible(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isMobile && !isInputFocused ? 'pb-mobile-nav' : ''}`}>
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ws={ws}
          sendMessage={sendMessage}
          messages={messages}
          isMobile={isMobile}
          isPWA={isPWA}
          onMenuClick={() => setSidebarOpen(true)}
          isLoading={isLoadingProjects}
          onInputFocusChange={setIsInputFocused}
          onSessionActive={markSessionAsActive}
          onSessionInactive={markSessionAsInactive}
          onSessionProcessing={markSessionAsProcessing}
          onSessionNotProcessing={markSessionAsNotProcessing}
          processingSessions={processingSessions}
          onReplaceTemporarySession={replaceTemporarySession}
          onNavigateToSession={(sessionId) => navigate(`/session/${sessionId}`)}
          onShowSettings={() => setShowSettings(true)}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          showThinking={showThinking}
          autoScrollToBottom={autoScrollToBottom}
          sendByCtrlEnter={sendByCtrlEnter}
          externalMessageUpdate={externalMessageUpdate}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInputFocused={isInputFocused}
        />
      )}

      {/* Quick Settings Panel */}
      {activeTab === 'chat' && (
        <QuickSettingsPanel
          isOpen={showQuickSettings}
          onToggle={setShowQuickSettings}
          autoExpandTools={autoExpandTools}
          onAutoExpandChange={setAutoExpandTools}
          showRawParameters={showRawParameters}
          onShowRawParametersChange={setShowRawParameters}
          showThinking={showThinking}
          onShowThinkingChange={setShowThinking}
          autoScrollToBottom={autoScrollToBottom}
          onAutoScrollChange={setAutoScrollToBottom}
          sendByCtrlEnter={sendByCtrlEnter}
          onSendByCtrlEnterChange={setSendByCtrlEnter}
          isMobile={isMobile}
        />
      )}

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsInitialTab}
      />

      {/* Version Upgrade Modal */}
      <VersionUpgradeModal />
    </div>
  );
}

// Root App component with router
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <TasksSettingsProvider>
            <TaskMasterProvider>
              <ProtectedRoute>
                <Router future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true
                }}>
                  <Routes>
                    <Route path="/" element={<AppContent />} />
                    <Route path="/session/:sessionId" element={<AppContent />} />
                  </Routes>
                </Router>
              </ProtectedRoute>
            </TaskMasterProvider>
          </TasksSettingsProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
