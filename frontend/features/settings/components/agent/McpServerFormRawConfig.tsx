/**
 * McpServerFormRawConfig Component
 *
 * Display of raw configuration when editing an existing MCP server.
 */

import React from 'react';
import { McpServer } from '../../types/settings.types';

export interface McpServerFormRawConfigProps {
  editingServer: McpServer;
  rawConfig: any;
}

/**
 * McpServerFormRawConfig - Display raw configuration details
 */
export const McpServerFormRawConfig: React.FC<McpServerFormRawConfigProps> = ({
  editingServer,
  rawConfig
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h4 className="text-sm font-medium text-foreground mb-2">
        Configuration Details (from {editingServer.scope === 'user' ? '~/.claude.json' : 'project config'})
      </h4>
      <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
        {JSON.stringify(rawConfig, null, 2)}
      </pre>
    </div>
  );
};

export default McpServerFormRawConfig;
