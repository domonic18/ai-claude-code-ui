/**
 * McpServerFormHttp Component
 *
 * SSE/HTTP transport configuration fields for MCP servers.
 * Provides URL and headers input fields.
 */

import React from 'react';
import { Input } from '@/shared/components/ui/Input';

export interface McpServerFormHttpProps {
  url?: string;
  headers?: Record<string, string>;
  onUrlChange: (url: string) => void;
  onHeadersChange: (headers: Record<string, string>) => void;
}

/**
 * McpServerFormHttp - SSE/HTTP transport configuration
 */
export const McpServerFormHttp: React.FC<McpServerFormHttpProps> = ({
  url,
  headers = {},
  onUrlChange,
  onHeadersChange
}) => {
  const handleHeadersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const headersObj: Record<string, string> = {};
    e.target.value.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim()) {
        headersObj[key.trim()] = valueParts.join('=').trim();
      }
    });
    onHeadersChange(headersObj);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          URL *
        </label>
        <Input
          value={url || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUrlChange(e.target.value)}
          placeholder="https://api.example.com/mcp"
          type="url"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Headers (KEY=value, one per line)
        </label>
        <textarea
          value={Object.entries(headers || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
          onChange={handleHeadersChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          rows={3}
          placeholder={`Authorization=Bearer token
X-API-Key=your-key`}
        />
      </div>
    </div>
  );
};

export default McpServerFormHttp;
