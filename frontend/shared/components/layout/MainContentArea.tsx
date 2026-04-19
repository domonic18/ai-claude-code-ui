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

/**
 * Renders the chat tab with ChatInterface wrapped in ErrorBoundary
 */
function renderChatTab(props: MainContentAreaProps, chatProject: any, chatSession: any) {
  return (
    <div className={`h-full ${props.activeTab === 'chat' ? 'block' : 'hidden'}`}>
      <ErrorBoundary showDetails={true}>
        <ChatInterface
          selectedProject={chatProject}
          selectedSession={chatSession}
          newSessionCounter={props.newSessionCounter}
          ws={props.ws}
          sendMessage={props.sendMessage}
          wsMessages={props.messages}
          onFileOpen={props.onFileOpen}
          onInputFocusChange={props.onInputFocusChange}
          onSessionActive={props.onSessionActive}
          onSessionInactive={props.onSessionInactive}
          onSessionProcessing={props.onSessionProcessing}
          onSessionNotProcessing={props.onSessionNotProcessing}
          processingSessions={props.processingSessions}
          onReplaceTemporarySession={props.onReplaceTemporarySession}
          onShowSettings={props.onShowSettings}
          autoExpandTools={props.autoExpandTools}
          showRawParameters={props.showRawParameters}
          showThinking={props.showThinking}
          autoScrollToBottom={props.autoScrollToBottom}
          sendByCtrlEnter={props.sendByCtrlEnter}
          externalMessageUpdate={props.externalMessageUpdate}
          authenticatedFetch={props.authenticatedFetch}
        />
      </ErrorBoundary>
    </div>
  );
}

/**
 * Renders the files tab with FileTree
 */
function renderFilesTab(props: MainContentAreaProps) {
  if (props.activeTab !== 'files') return null;
  return (
    <div className="h-full overflow-hidden">
      <FileTree selectedProject={props.selectedProject as any} />
    </div>
  );
}

/**
 * Renders the shell tab with StandaloneShell
 */
function renderShellTab(props: MainContentAreaProps) {
  if (props.activeTab !== 'shell') return null;
  return (
    <div className="h-full w-full overflow-hidden">
      <StandaloneShell
        project={props.selectedProject as any}
        session={props.selectedSession as any}
        showHeader={false}
      />
    </div>
  );
}

export function MainContentArea(props: MainContentAreaProps) {
  // Memoize selectedProject for ChatInterface to prevent unnecessary re-renders
  const chatProject = React.useMemo(() => {
    if (!props.selectedProject) return undefined;
    return {
      name: props.selectedProject.name,
      path: props.selectedProject.fullPath
    };
  }, [props.selectedProject?.name, props.selectedProject?.fullPath]);

  // Memoize selectedSession for ChatInterface to prevent unnecessary re-renders
  const chatSession = React.useMemo(() => {
    if (!props.selectedSession) return undefined;
    const id = (props.selectedSession as any).id || (props.selectedSession as any).summary || 'temp';
    return {
      id,
      __provider: props.selectedSession.__provider
    };
  }, [props.selectedSession]);

  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${props.editingFile ? 'mr-0' : ''} ${props.editorExpanded ? 'hidden' : ''}`}>
      {renderChatTab(props, chatProject, chatSession)}
      {renderFilesTab(props)}
      {renderShellTab(props)}
    </div>
  );
}
