/**
 * ChatInterface Component (Refactored)
 *
 * Main chat interface component using modular architecture.
 * This component now delegates to specialized hooks for better separation of concerns.
 *
 * Responsibilities:
 * - Orchestrate chat sub-components
 * - Render UI using state from useChatInterface hook
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useChatInterface } from '../hooks';
import { ChatInterfaceRenderer } from './ChatInterfaceRenderer';
import type { ChatMessage, FileAttachment } from '../types';

/**
 * Prepare ChatInput props from hook state
 */
function prepareChatInputProps(hook: any, selectedProject: any, t: any, sendByCtrlEnter: boolean) {
  return {
    value: hook.input,
    onChange: hook.handleInputChangeWithCommands,
    onSend: hook.handleSend,
    files: hook.attachedFiles,
    onAddFile: hook.handleAddFile,
    onRemoveFile: hook.handleRemoveFile,
    disabled: hook.isLoading,
    isLoading: hook.isLoading,
    sendByCtrlEnter,
    onFocusChange: hook.handleInputFocusChange,
    projectName: selectedProject?.name,
    placeholder: selectedProject
      ? t('chat.messageAbout', { project: selectedProject.name })
      : t('chat.selectProject'),
    commands: hook.filteredCommands,
    frequentCommands: hook.frequentCommands,
    commandMenuOpen: hook.showCommandMenu,
    commandQuery: hook.commandQuery,
    selectedCommandIndex: hook.selectedCommandIndex,
    slashPosition: hook.slashPosition,
    onCommandSelect: hook.handleCommandSelectWrapper,
    onCommandMenuClose: hook.handleCommandMenuClose,
    fileReferences: hook.filteredFileReferences,
    fileMenuOpen: hook.showFileMenu,
    fileQuery: hook.fileQuery,
    selectedFileIndex: hook.selectedFileIndex,
    atPosition: hook.atPosition,
    onFileSelect: (file: any, index: number, isHover?: boolean) => {
      hook.handleFileSelectWrapper(file, index, isHover);
    },
    onFileMenuClose: hook.handleFileMenuClose,
    filesLoading: hook.filesLoading,
    authenticatedFetch: hook.authenticatedFetch,
    selectedProject,
  };
}

interface ChatInterfaceProps {
  /** Selected project */
  selectedProject?: {
    name: string;
    path: string;
  };
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected session */
  selectedSession?: {
    id: string;
    __provider?: string;
  };
  /** New session counter - increments when user clicks "New Session" */
  newSessionCounter?: number;
  /** WebSocket connection */
  ws?: WebSocket | null;
  /** Send message via WebSocket */
  sendMessage?: (message: any) => void;
  /** WebSocket messages from parent */
  wsMessages?: any[];
  /** Initial messages (from parent) */
  messages?: ChatMessage[];
  /** Callback for opening files */
  onFileOpen?: (filePath: string, diffData?: any) => void;
  /** Callback for input focus changes */
  onInputFocusChange?: (isFocused: boolean) => void;
  /** Callback when session becomes active */
  onSessionActive?: (sessionId: string) => void;
  /** Callback when session becomes inactive */
  onSessionInactive?: (sessionId: string) => void;
  /** Callback when session is processing */
  onSessionProcessing?: (sessionId: string) => void;
  /** Callback when session is not processing */
  onSessionNotProcessing?: (sessionId: string) => void;
  /** Set of currently processing sessions */
  processingSessions?: Set<string>;
  /** Callback to replace temporary session ID */
  onReplaceTemporarySession?: (tempId: string, realSessionId: string) => void;
  /** Callback to show settings */
  onShowSettings?: () => void;
  /** Auto-expand tools by default */
  autoExpandTools?: boolean;
  /** Show raw parameters */
  showRawParameters?: boolean;
  /** Show thinking process */
  showThinking?: boolean;
  /** Auto-scroll to bottom */
  autoScrollToBottom?: boolean;
  /** Send with Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** External message update */
  externalMessageUpdate?: number;
  /** Callback for task click */
  onTaskClick?: (taskId: string) => void;
  /** Callback to show all tasks */
  onShowAllTasks?: () => void;
  /** Set token budget */
  onSetTokenBudget?: (budget: any) => void;
}

/**
 * ChatInterface Component
 *
 * Main orchestrator for chat functionality using modular components and hooks.
 * All complex logic is extracted to useChatInterface hook.
 */
export function ChatInterface({
  selectedProject,
  selectedSession,
  newSessionCounter = 0,
  ws,
  sendMessage,
  wsMessages,
  messages: externalMessages,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onShowSettings,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = true,
  autoScrollToBottom = true,
  sendByCtrlEnter = false,
  externalMessageUpdate,
  onTaskClick,
  onShowAllTasks,
  onSetTokenBudget,
}: ChatInterfaceProps) {
  const { t } = useTranslation();

  // Use the centralized hook for all state management and complex logic
  const hook = useChatInterface({
    selectedProject, selectedSession, newSessionCounter, onFileOpen, onShowSettings, onInputFocusChange,
    onSessionActive, onSessionInactive, onSessionProcessing, onSessionNotProcessing, onReplaceTemporarySession,
    onShowAllTasks, onSetTokenBudget, externalMessageUpdate, onTaskClick, wsMessages, messages: externalMessages, ws, sendMessage,
  });

  // Prepare ChatInput props
  const chatInputProps = prepareChatInputProps(hook, selectedProject, t, sendByCtrlEnter);

  return <ChatInterfaceRenderer hook={hook} autoExpandTools={autoExpandTools} showRawParameters={showRawParameters} showThinking={showThinking} autoScrollToBottom={autoScrollToBottom} selectedProject={selectedProject} onFileOpen={onFileOpen} onShowSettings={onShowSettings} ws={ws} sendMessage={sendMessage} chatInputProps={chatInputProps} />;
}

export default React.memo(ChatInterface);
