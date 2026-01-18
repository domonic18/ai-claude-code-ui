/*
 * MainContent.tsx - Main Content Area with Session Protection Props Passthrough
 *
 * SESSION PROTECTION PASSTHROUGH:
 * ===============================
 *
 * This component serves as a passthrough layer for Session Protection functions:
 * - Receives session management functions from App.tsx
 * - Passes them down to ChatInterface.tsx
 *
 * No session protection logic is implemented here - it's purely a props bridge.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatInterface } from '@/features/chat/components';
import { FileTree } from '@/features/file-explorer';
import { CodeEditor } from '@/features/editor';
import { StandaloneShell } from '@/features/terminal';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import { ClaudeLogo, CursorLogo } from '@/shared/assets/icons';
import { PRDEditor } from '@/features/editor';
import Tooltip from '@/shared/components/ui/Tooltip';
import { api } from '@/shared/services';
import type { Project as SidebarProject } from '@/features/sidebar/types/sidebar.types';

// Types
interface Project extends SidebarProject {
  path?: string; // Legacy property, use fullPath instead
}

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  [key: string]: any;
}

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

interface PRDFile {
  name: string;
  content?: string;
  isExisting?: boolean;
}

export interface MainContentProps {
  selectedProject?: Project | null;
  selectedSession?: Session | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  ws?: any;
  sendMessage: (message: any) => void;
  messages: any[];
  isMobile: boolean;
  isPWA: boolean;
  onMenuClick: () => void;
  isLoading: boolean;
  onInputFocusChange?: (focused: boolean) => void;
  // Session Protection Props
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;
  processingSessions?: Set<string>;
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
  onNavigateToSession?: (sessionId: string) => void;
  onShowSettings?: () => void;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  showThinking?: boolean;
  autoScrollToBottom?: boolean;
  sendByCtrlEnter?: boolean;
  externalMessageUpdate?: number;
}

function MainContent({
  selectedProject,
  selectedSession,
  activeTab,
  setActiveTab,
  ws,
  sendMessage,
  messages,
  isMobile,
  isPWA,
  onMenuClick,
  isLoading,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onNavigateToSession,
  onShowSettings,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = false,
  autoScrollToBottom = true,
  sendByCtrlEnter = false,
  externalMessageUpdate
}: MainContentProps) {
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [editorWidth, setEditorWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Memoize selectedProject for ChatInterface to prevent unnecessary re-renders
  const chatProject = useMemo(() => {
    if (!selectedProject) return undefined;
    return {
      name: selectedProject.name,
      path: selectedProject.fullPath
    };
  }, [selectedProject?.name, selectedProject?.fullPath]);

  // Memoize selectedSession for ChatInterface to prevent unnecessary re-renders
  const chatSession = useMemo(() => {
    if (!selectedSession) return undefined;
    const id = (selectedSession as any).id || (selectedSession as any).summary || 'temp';
    return {
      id,
      __provider: selectedSession.__provider
    };
  }, [selectedSession]);

  // PRD Editor state
  const [showPRDEditor, setShowPRDEditor] = useState(false);
  const [selectedPRD, setSelectedPRD] = useState<PRDFile | null>(null);
  const [existingPRDs, setExistingPRDs] = useState<any[]>([]);
  const [prdNotification, setPRDNotification] = useState<string | null>(null);

  // Load existing PRDs when selected project changes
  useEffect(() => {
    const loadExistingPRDs = async () => {
      if (!selectedProject?.name) {
        setExistingPRDs([]);
        return;
      }

      try {
        const response = await api.get(`/taskmaster/prd/${encodeURIComponent(selectedProject.name)}`);
        if (response.ok) {
          const responseData = await response.json();
          const data = responseData.data;
          setExistingPRDs(data?.prdFiles || []);
        } else {
          setExistingPRDs([]);
        }
      } catch (error) {
        console.error('Failed to load existing PRDs:', error);
        setExistingPRDs([]);
      }
    };

    loadExistingPRDs();
  }, [selectedProject?.name]);

  const handleFileOpen = (filePath: string, diffInfo: any = null) => {
    const file: File = {
      name: filePath.split('/').pop() || '',
      path: filePath,
      projectName: selectedProject?.name,
      diffInfo: diffInfo
    };
    setEditingFile(file);
  };

  const handleCloseEditor = () => {
    setEditingFile(null);
    setEditorExpanded(false);
  };

  const handleToggleEditorExpand = () => {
    setEditorExpanded(!editorExpanded);
  };

  // Handle resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = resizeRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;

      const minWidth = 300;
      const maxWidth = containerRect.width * 0.8;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setEditorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isMobile]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {isMobile && (
          <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 pwa-menu-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="w-12 h-12 mx-auto mb-4">
              <div
                className="w-full h-full rounded-full border-4 border-gray-200 border-t-blue-500"
                style={{
                  animation: 'spin 1s linear infinite',
                  WebkitAnimation: 'spin 1s linear infinite',
                  MozAnimation: 'spin 1s linear infinite'
                }}
              />
            </div>
            <h2 className="text-xl font-semibold mb-2">Loading Claude Code UI</h2>
            <p>Setting up your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {isMobile && (
          <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 pwa-menu-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400 max-w-md mx-auto px-6">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">Choose Your Project</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Select a project from the sidebar to start coding with Claude. Each project contains your chat sessions and file history.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> {isMobile ? 'Tap the menu button above to access projects' : 'Create a new project by clicking the folder icon in the sidebar'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
        <div className="flex items-center justify-between relative">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {isMobile && (
              <button
                onClick={onMenuClick}
                onTouchStart={(e) => {
                  e.preventDefault();
                  onMenuClick();
                }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation active:scale-95 pwa-menu-button flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
              {activeTab === 'chat' && selectedSession && (
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {selectedSession.__provider === 'cursor' ? (
                    <CursorLogo className="w-4 h-4" />
                  ) : (
                    <ClaudeLogo className="w-4 h-4" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {activeTab === 'chat' && selectedSession ? (
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap overflow-x-auto scrollbar-hide">
                      {selectedSession.summary || selectedSession.name || (selectedSession as any).title || (selectedSession.__provider === 'cursor' ? 'Untitled Session' : 'New Session')}
                    </h2>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {selectedProject.displayName}
                    </div>
                  </div>
                ) : activeTab === 'chat' && !selectedSession ? (
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      New Session
                    </h2>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {selectedProject.displayName}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      {activeTab === 'files' ? 'Project Files' : 'Project'}
                    </h2>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {selectedProject.displayName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modern Tab Navigation - Right Side */}
          <div className="flex-shrink-0 hidden sm:block">
            <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Tooltip content="Chat" position="bottom">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                    activeTab === 'chat'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="hidden md:hidden lg:inline">Chat</span>
                  </span>
                </button>
              </Tooltip>
              <Tooltip content="Shell" position="bottom">
                <button
                  onClick={() => setActiveTab('shell')}
                  className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'shell'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden md:hidden lg:inline">Shell</span>
                  </span>
                </button>
              </Tooltip>
              <Tooltip content="Files" position="bottom">
                <button
                  onClick={() => setActiveTab('files')}
                  className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'files'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="hidden md:hidden lg:inline">Files</span>
                  </span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area with Right Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${editingFile ? 'mr-0' : ''} ${editorExpanded ? 'hidden' : ''}`}>
          <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <ErrorBoundary showDetails={true}>
              <ChatInterface
                selectedProject={chatProject}
                selectedSession={chatSession}
                ws={ws}
                sendMessage={sendMessage}
                wsMessages={selectedSession ? messages : []}
                onFileOpen={handleFileOpen}
                onInputFocusChange={onInputFocusChange}
                onSessionActive={onSessionActive}
                onSessionInactive={onSessionInactive}
                onSessionProcessing={onSessionProcessing}
                onSessionNotProcessing={onSessionNotProcessing}
                processingSessions={processingSessions}
                onReplaceTemporarySession={onReplaceTemporarySession}
                onNavigateToSession={onNavigateToSession}
                onShowSettings={onShowSettings}
                autoExpandTools={autoExpandTools}
                showRawParameters={showRawParameters}
                showThinking={showThinking}
                autoScrollToBottom={autoScrollToBottom}
                sendByCtrlEnter={sendByCtrlEnter}
                externalMessageUpdate={externalMessageUpdate}
              />
            </ErrorBoundary>
          </div>
          {activeTab === 'files' && (
            <div className="h-full overflow-hidden">
              <FileTree selectedProject={selectedProject as any} />
            </div>
          )}
          {activeTab === 'shell' && (
            <div className="h-full w-full overflow-hidden">
              <StandaloneShell
                project={selectedProject as any}
                session={selectedSession as any}
                showHeader={false}
              />
            </div>
          )}
        </div>

        {/* Code Editor Right Sidebar - Desktop only, Mobile uses modal */}
        {editingFile && !isMobile && (
          <>
            {!editorExpanded && (
              <div
                ref={resizeRef}
                onMouseDown={handleMouseDown}
                className="flex-shrink-0 w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize transition-colors relative group"
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-blue-500 dark:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            <div
              className={`flex-shrink-0 border-l border-gray-200 dark:border-gray-700 h-full overflow-hidden ${editorExpanded ? 'flex-1' : ''}`}
              style={editorExpanded ? {} : { width: `${editorWidth}px` }}
            >
              <CodeEditor
                file={editingFile}
                onClose={handleCloseEditor}
                projectPath={selectedProject?.fullPath}
                isSidebar={true}
                isExpanded={editorExpanded}
                onToggleExpand={handleToggleEditorExpand}
              />
            </div>
          </>
        )}
      </div>

      {/* Code Editor Modal for Mobile */}
      {editingFile && isMobile && (
        <CodeEditor
          file={editingFile}
          onClose={handleCloseEditor}
          projectPath={selectedProject?.fullPath}
          isSidebar={false}
        />
      )}

      {/* PRD Editor Modal */}
      {showPRDEditor && (
        <PRDEditor
          project={selectedProject as any}
          projectPath={selectedProject?.fullPath}
          onClose={() => {
            setShowPRDEditor(false);
            setSelectedPRD(null);
          }}
          isNewFile={!selectedPRD?.isExisting}
          file={{
            name: selectedPRD?.name || 'prd.txt',
            path: selectedPRD?.name || '',
            content: selectedPRD?.content || ''
          } as any}
          onSave={async () => {
            setShowPRDEditor(false);
            setSelectedPRD(null);

            try {
              const response = await api.get(`/taskmaster/prd/${encodeURIComponent(selectedProject.name)}`);
              if (response.ok) {
                const responseData = await response.json();
                const data = responseData.data;
                setExistingPRDs(data?.prdFiles || []);
                setPRDNotification('PRD saved successfully!');
                setTimeout(() => setPRDNotification(null), 3000);
              }
            } catch (error) {
              console.error('Failed to refresh PRDs:', error);
            }
          }}
        />
      )}

      {/* PRD Notification */}
      {prdNotification && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{prdNotification}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(MainContent);
