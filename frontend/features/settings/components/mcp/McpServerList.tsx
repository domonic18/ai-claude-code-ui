/**
 * McpServerList Component
 *
 * Displays and manages MCP servers for Claude agent.
 * Provides list view, add/edit/delete actions, test functionality, and tools discovery.
 *
 * Migrated from: frontend/components/settings/McpServersContent.jsx
 * Note: Cursor and Codex variants have been removed as they are no longer supported.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { Server, Plus } from 'lucide-react';
import { McpServer } from '../../types/settings.types';
import { McpServerCard } from './McpServerCard';

interface McpServerListProps {
  agent: string;
  servers: McpServer[];
  onAdd: () => void;
  onEdit: (server: McpServer) => void;
  onDelete: (serverId: string) => void;
  onTest: (serverId: string, scope: string) => void;
  onDiscoverTools: (serverId: string, scope: string) => void;
  testResults: Record<string, any>;
  serverTools: Record<string, any>;
  toolsLoading: Record<string, boolean>;
}

/**
 * McpServerList - Main MCP servers management interface
 */
export const McpServerList: React.FC<McpServerListProps> = ({
  servers,
  onAdd,
  onEdit,
  onDelete,
  onTest,
  onDiscoverTools,
  testResults,
  serverTools,
  toolsLoading
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Server className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-medium text-foreground">
          {t('mcp.title')}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('mcp.description')}
      </p>

      <div className="flex justify-between items-center">
        <Button
          onClick={onAdd}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('mcp.addServer')}
        </Button>
      </div>

      <div className="space-y-2">
        {servers.map(server => (
          <McpServerCard
            key={server.id}
            server={server}
            testResult={testResults?.[server.id]}
            serverTools={serverTools?.[server.id]}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {servers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('mcp.noServers')}
          </div>
        )}
      </div>
    </div>
  );
};

export default McpServerList;
