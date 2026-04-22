/**
 * useMcpFormState Hook
 *
 * Custom hook that manages MCP server form state.
 * Extracted from useAgentMcpServers to improve modularity.
 *
 * Features:
 * - Form display state
 * - Form data state
 * - JSON validation error state
 * - Editing server state
 */

import { useState, useCallback } from 'react';
import { McpServer } from '../types/settings.types';
import { McpFormData } from '../components/agent/McpServerForm';

/**
 * Create empty MCP form data structure
 * @returns {McpFormData} Empty form data with default values
 */
export const createEmptyMcpFormData = (): McpFormData => ({
  name: '',
  type: 'stdio',
  scope: 'user',
  projectPath: '',
  importMode: 'form',
  jsonInput: '',
  config: {
    command: '',
    args: [],
    env: {},
    url: '',
    headers: {},
    timeout: 30000
  }
});

export interface UseMcpFormStateReturn {
  showMcpForm: boolean;
  editingMcpServer: McpServer | null;
  mcpFormData: McpFormData;
  jsonValidationError: string;
  openMcpForm: (server?: McpServer | null) => void;
  resetMcpForm: () => void;
  updateMcpConfig: (key: string, value: any) => void;
  setMcpFormData: (data: McpFormData) => void;
  setJsonValidationError: (error: string) => void;
}

// 由组件调用，自定义 Hook：useMcpFormState
/**
 * Custom hook to manage MCP server form state
 * @returns {UseMcpFormStateReturn} Form state and handlers
 */
export function useMcpFormState(): UseMcpFormStateReturn {
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [mcpFormData, setMcpFormData] = useState<McpFormData>(createEmptyMcpFormData());
  const [jsonValidationError, setJsonValidationError] = useState('');

  /**
   * Open MCP form for adding or editing a server
   * @param {McpServer | null} server - Server to edit, or null for new server
   */
  const openMcpForm = useCallback((server: McpServer | null = null) => {
    if (server) {
      setEditingMcpServer(server);
      setMcpFormData({
        name: server.name,
        type: server.type,
        scope: server.scope,
        projectPath: server.projectPath || '',
        config: { ...server.config },
        raw: server.raw,
        importMode: 'form',
        jsonInput: ''
      });
    } else {
      setEditingMcpServer(null);
      setMcpFormData(createEmptyMcpFormData());
    }
    setJsonValidationError('');
    setShowMcpForm(true);
  }, []);

  /**
   * Reset MCP form to initial state
   */
  const resetMcpForm = useCallback(() => {
    setShowMcpForm(false);
    setEditingMcpServer(null);
    setMcpFormData(createEmptyMcpFormData());
    setJsonValidationError('');
  }, []);

  /**
   * Update MCP config field
   * @param {string} key - Config field key
   * @param {any} value - Config field value
   */
  const updateMcpConfig = useCallback((key: string, value: any) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  }, []);

  return {
    showMcpForm,
    editingMcpServer,
    mcpFormData,
    jsonValidationError,
    openMcpForm,
    resetMcpForm,
    updateMcpConfig,
    setMcpFormData,
    setJsonValidationError
  };
}
