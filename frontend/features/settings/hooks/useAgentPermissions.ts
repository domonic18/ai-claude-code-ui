/**
 * useAgentPermissions Hook
 *
 * Custom hook that manages Claude agent permissions state and operations.
 * Extracted from useAgentTab to improve modularity and maintainability.
 *
 * Features:
 * - Permission state management (skip, allowed, disallowed tools)
 * - Load permissions from settings service
 * - Save permissions to settings service
 */

import { useState, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import { logger } from '@/shared/utils/logger';

export interface UseAgentPermissionsReturn {
  skipPermissions: boolean;
  setSkipPermissions: (value: boolean) => void;
  allowedTools: string[];
  setAllowedTools: (tools: string[]) => void;
  disallowedTools: string[];
  setDisallowedTools: (tools: string[]) => void;
  newAllowedTool: string;
  setNewAllowedTool: (tool: string) => void;
  newDisallowedTool: string;
  setNewDisallowedTool: (tool: string) => void;
  savePermissions: () => void;
}

/**
 * Custom hook to manage Claude agent permissions
 * @returns {UseAgentPermissionsReturn} Permissions state and handlers
 */
export function useAgentPermissions(): UseAgentPermissionsReturn {
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  /**
   * Load permissions from settings service on mount
   */
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const service = getSettingsService();
        const permissions = await service.getPermissions();

        setSkipPermissions(permissions.skipPermissions || false);
        setAllowedTools(permissions.allowedTools || []);
        setDisallowedTools(permissions.disallowedTools || []);
      } catch (error) {
        logger.error('[AgentPermissions] Error loading permissions:', error);
      }
    };

    loadPermissions();
  }, []);

  /**
   * Save permissions to settings service
   */
  const savePermissions = async () => {
    try {
      const service = getSettingsService();
      const result = await service.updatePermissions({
        skipPermissions,
        allowedTools,
        disallowedTools,
      });

      if (result.success) {
        logger.info('[AgentPermissions] Permissions saved successfully:', result.message);
      } else {
        logger.error('[AgentPermissions] Failed to save permissions');
      }
    } catch (error) {
      logger.error('[AgentPermissions] Error saving permissions:', error);
    }
  };

  return {
    skipPermissions,
    setSkipPermissions,
    allowedTools,
    setAllowedTools,
    disallowedTools,
    setDisallowedTools,
    newAllowedTool,
    setNewAllowedTool,
    newDisallowedTool,
    setNewDisallowedTool,
    savePermissions,
  };
}
