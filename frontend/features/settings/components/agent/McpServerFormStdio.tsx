/**
 * McpServerFormStdio Component
 *
 * stdio transport configuration fields for MCP servers.
 * Provides command and arguments input fields.
 */

import React from 'react';
import { Input } from '@/shared/components/ui/Input';

export interface McpServerFormStdioProps {
  command?: string;
  args?: string[];
  onCommandChange: (command: string) => void;
  onArgsChange: (args: string[]) => void;
}

/**
 * McpServerFormStdio - stdio transport configuration
 */
export const McpServerFormStdio: React.FC<McpServerFormStdioProps> = ({
  command,
  args = [],
  onCommandChange,
  onArgsChange
}) => {
  const handleArgsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const argsArray = e.target.value.split('\n').filter(arg => arg.trim());
    onArgsChange(argsArray);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Command *
        </label>
        <Input
          value={command || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCommandChange(e.target.value)}
          placeholder="/path/to/mcp-server"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Arguments (one per line)
        </label>
        <textarea
          value={Array.isArray(args) ? args.join('\n') : ''}
          onChange={handleArgsChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          rows={3}
          placeholder={`--api-key
abc123`}
        />
      </div>
    </div>
  );
};

export default McpServerFormStdio;
