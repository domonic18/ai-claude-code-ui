/*
 * MainContentArea.tsx - Main content area with chat, files, and shell tabs
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChatInterface } from '@/features/chat/components';
import { FileTree } from '@/features/file-explorer';
import { StandaloneShell } from '@/features/terminal';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import type { Project as SidebarProject } from '@/features/sidebar/types/sidebar.types';

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

interface Project extends SidebarProject {
  path?: string;
}

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  [key: string]: any;
}

interface MainContentAreaProps {
  activeTab: string;
  selectedProject?: Project | null;
  selectedSession?: Session | null;
  newSessionCounter: number;
  ws?: any;
  sendMessage: (message: any) => void;
  messages: any[];
  onFileOpen: (filePath: string, diffInfo: any) => void;
  onInputFocusChange?: (focused: boolean) => void;
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;
  processingSessions?: Set<string>;
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
  onShowSettings?: () => void;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  showThinking: boolean;
  autoScrollToBottom: boolean;
  sendByCtrlEnter: boolean;
  externalMessageUpdate?: number;
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  editingFile?: File | null;
  editorExpanded: boolean;
}

export function MainContentArea({
  activeTab,
  selectedProject,
  selectedSession,
  newSessionCounter,
  ws,
  sendMessage,
  messages,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onShowSettings,
  autoExpandTools,
  showRawParameters,
  showThinking,
  autoScrollToBottom,
  sendByCtrlEnter,
  externalMessageUpdate,
  authenticatedFetch,
  editingFile,
  editorExpanded
}: MainContentAreaProps) {
  // Memoize selectedProject for ChatInterface to prevent unnecessary re-renders
  const chatProject = React.useMemo(() => {
    if (!selectedProject) return undefined;
    return {
      name: selectedProject.name,
      path: selectedProject.fullPath
    };
  }, [selectedProject?.name, selectedProject?.fullPath]);

  // Memoize selectedSession for ChatInterface to prevent unnecessary re-renders
  const chatSession = React.useMemo(() => {
    if (!selectedSession) return undefined;
    const id = (selectedSession as any).id || (selectedSession as any).summary || 'temp';
    return {
      id,
      __provider: selectedSession.__provider
    };
  }, [selectedSession]);

  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${editingFile ? 'mr-0' : ''} ${editorExpanded ? 'hidden' : ''}`}>
      <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
        <ErrorBoundary showDetails={true}>
          <ChatInterface
            selectedProject={chatProject}
            selectedSession={chatSession}
            newSessionCounter={newSessionCounter}
            ws={ws}
            sendMessage={sendMessage}
            wsMessages={messages}
            onFileOpen={onFileOpen}
            onInputFocusChange={onInputFocusChange}
            onSessionActive={onSessionActive}
            onSessionInactive={onSessionInactive}
            onSessionProcessing={onSessionProcessing}
            onSessionNotProcessing={onSessionNotProcessing}
            processingSessions={processingSessions}
            onReplaceTemporarySession={onReplaceTemporarySession}
            onShowSettings={onShowSettings}
            autoExpandTools={autoExpandTools}
            showRawParameters={showRawParameters}
            showThinking={showThinking}
            autoScrollToBottom={autoScrollToBottom}
            sendByCtrlEnter={sendByCtrlEnter}
            externalMessageUpdate={externalMessageUpdate}
            authenticatedFetch={authenticatedFetch}
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
  );
}
