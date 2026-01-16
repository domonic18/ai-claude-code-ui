/**
 * TransportSelector Component
 *
 * Allows users to select the transport type for MCP servers (stdio, SSE, HTTP).
 */

import React from 'react';
import { McpTransportType } from '../../types/settings.types';

interface TransportSelectorProps {
  type: McpTransportType;
  onChange: (type: McpTransportType) => void;
}

/**
 * TransportSelector - Provides transport type selection for MCP servers
 */
export const TransportSelector: React.FC<TransportSelectorProps> = ({
  type,
  onChange
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Transport Type *
      </label>
      <select
        value={type}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as McpTransportType)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="stdio">stdio</option>
        <option value="sse">SSE</option>
        <option value="http">HTTP</option>
      </select>
    </div>
  );
};

export default TransportSelector;
