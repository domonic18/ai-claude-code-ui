/*
 * MainContentLayout.tsx - Layout wrapper for main content with header and content area
 */

import React from 'react';
import { MainContentHeader } from './MainContentHeader';
import { MainContentArea } from './MainContentArea';
import { CodeEditorSidebar } from './CodeEditorSidebar';

interface Project {
  name?: string;
  displayName?: string;
  fullPath?: string;
  [key: string]: any;
}

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  title?: string;
  [key: string]: any;
}

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

interface MainContentLayoutProps {
  isMobile: boolean;
  activeTab: string;
  selectedSession?: Session | null;
  selectedProject?: Project | null;
  onMenuClick: () => void;
  setActiveTab: (tab: string) => void;
  newSessionCounter?: number;
  ws?: any;
  sendMessage: (message: any) => void;
  messages: any[];
  onFileOpen?: (filePath: string, diffInfo: any) => void;
  onInputFocusChange?: (focused: boolean) => void;
  onSessionActive?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  onSessionProcessing?: (sessionId: string) => void;
  onSessionNotProcessing?: (sessionId: string) => void;
  processingSessions?: Set<string>;
  onReplaceTemporarySession?: (tempId: string, realId: string) => void;
  onShowSettings?: () => void;
  autoExpandTools?: boolean;
  showRawParameters?: boolean;
  showThinking?: boolean;
  autoScrollToBottom?: boolean;
  sendByCtrlEnter?: boolean;
  externalMessageUpdate?: number;
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  editingFile?: File | null;
  editorExpanded?: boolean;
  editorWidth?: number;
  isResizing?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClose?: () => void;
  onToggleExpand?: () => void;
  /** Aliases from useMainContentState (handleFileOpen, handleCloseEditor, etc.) */
  handleFileOpen?: (filePath: string, diffInfo?: any, projectName?: string) => void;
  handleCloseEditor?: () => void;
  handleToggleEditorExpand?: () => void;
  handleMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * Sidebar-only props extracted from layout props
 */
function getSidebarProps(p: MainContentLayoutProps) {
  return {
    editingFile: p.editingFile,
    isMobile: p.isMobile,
    editorWidth: p.editorWidth ?? 600,
    editorExpanded: p.editorExpanded ?? false,
    projectPath: p.selectedProject?.fullPath,
    isResizing: p.isResizing ?? false,
    onMouseDown: p.onMouseDown ?? p.handleMouseDown ?? (() => {}),
    onClose: p.onClose ?? p.handleCloseEditor ?? (() => {}),
    onToggleExpand: p.onToggleExpand ?? p.handleToggleEditorExpand ?? (() => {}),
  };
}

export function MainContentLayout(props: MainContentLayoutProps) {
  const {
    isMobile, activeTab, selectedSession, selectedProject,
    onMenuClick, setActiveTab, /* header */
    editingFile, editorExpanded, /* shared */
    newSessionCounter, ws, sendMessage, messages,
    onFileOpen: onFileOpenProp,
    handleFileOpen: handleFileOpenProp,
    onInputFocusChange, onSessionActive, onSessionInactive,
    onSessionProcessing, onSessionNotProcessing, processingSessions,
    onReplaceTemporarySession, onShowSettings, autoExpandTools,
    showRawParameters, showThinking, autoScrollToBottom,
    sendByCtrlEnter, externalMessageUpdate, authenticatedFetch,
  } = props;

  const onFileOpen = onFileOpenProp ?? handleFileOpenProp ?? (() => {});

  return (
    <div className="h-full flex flex-col">
      <MainContentHeader
        isMobile={isMobile} activeTab={activeTab}
        selectedSession={selectedSession} selectedProject={selectedProject}
        onMenuClick={onMenuClick} setActiveTab={setActiveTab}
      />
      <div className="flex-1 flex min-h-0 overflow-hidden" data-editor-container>
        <MainContentArea
          activeTab={activeTab}
          selectedProject={selectedProject as any}
          selectedSession={selectedSession as any}
          newSessionCounter={newSessionCounter}
          ws={ws} sendMessage={sendMessage} messages={messages}
          onFileOpen={onFileOpen} onInputFocusChange={onInputFocusChange}
          onSessionActive={onSessionActive} onSessionInactive={onSessionInactive}
          onSessionProcessing={onSessionProcessing} onSessionNotProcessing={onSessionNotProcessing}
          processingSessions={processingSessions}
          onReplaceTemporarySession={onReplaceTemporarySession}
          onShowSettings={onShowSettings} autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters} showThinking={showThinking}
          autoScrollToBottom={autoScrollToBottom} sendByCtrlEnter={sendByCtrlEnter}
          externalMessageUpdate={externalMessageUpdate}
          authenticatedFetch={authenticatedFetch}
          editingFile={editingFile} editorExpanded={editorExpanded}
        />
        <CodeEditorSidebar {...getSidebarProps(props)} />
      </div>
    </div>
  );
}
