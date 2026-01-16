/**
 * McpServerCard Component
 *
 * Displays a single MCP server with its configuration, test results, and tools.
 * Provides edit and delete actions.
 *
 * Extracted from McpServersContent for better modularity.
 */

import React from 'react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Server, Terminal, Globe, Zap, Edit3, Trash2 } from 'lucide-react';
import { McpServer } from '../agent/McpServerForm';

type McpTransportType = 'stdio' | 'sse' | 'http';

interface McpServerCardProps {
  server: McpServer;
  testResult?: any;
  serverTools?: any;
  onEdit: (server: McpServer) => void;
  onDelete: (serverId: string) => void;
}

const getTransportIcon = (type: McpTransportType) => {
  switch (type) {
    case 'stdio': return <Terminal className="w-4 h-4" />;
    case 'sse': return <Zap className="w-4 h-4" />;
    case 'http': return <Globe className="w-4 h-4" />;
    default: return <Server className="w-4 h-4" />;
  }
};

/**
 * McpServerCard - Single MCP server display card
 */
export const McpServerCard: React.FC<McpServerCardProps> = ({
  server,
  testResult,
  serverTools,
  onEdit,
  onDelete
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getTransportIcon(server.type)}
            <span className="font-medium text-foreground">{server.name}</span>
            <Badge variant="outline" className="text-xs">
              {server.type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {server.scope === 'local' ? 'local' : server.scope === 'user' ? 'user' : server.scope}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            {server.type === 'stdio' && server.config?.command && (
              <div>Command: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.command}</code></div>
            )}
            {(server.type === 'sse' || server.type === 'http') && server.config?.url && (
              <div>URL: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.url}</code></div>
            )}
            {server.config?.args && server.config.args.length > 0 && (
              <div>Args: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.args.join(' ')}</code></div>
            )}
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`mt-2 p-2 rounded text-xs ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}>
              <div className="font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Tools Discovery Results */}
          {serverTools?.tools && serverTools.tools.length > 0 && (
            <div className="mt-2 p-2 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
              <div className="font-medium">Tools ({serverTools.tools.length}):</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {serverTools.tools.slice(0, 5).map((tool: any, i: number) => (
                  <code key={i} className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{tool.name}</code>
                ))}
                {serverTools.tools.length > 5 && (
                  <span className="text-xs opacity-75">+{serverTools.tools.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Button
            onClick={() => onEdit(server)}
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-700"
            title="Edit server"
          >
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => onDelete(server.id)}
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            title="Delete server"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default McpServerCard;
