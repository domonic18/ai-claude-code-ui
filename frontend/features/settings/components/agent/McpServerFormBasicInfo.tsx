/**
 * McpServerFormBasicInfo Component
 *
 * Basic information fields for MCP server configuration.
 * Includes server name and transport type selector.
 */

import React from 'react';
import { Input } from '@/shared/components/ui/Input';
import { TransportSelector } from '../common/TransportSelector';
import { McpTransportType } from '../../types/settings.types';

export interface McpServerFormBasicInfoProps {
  name: string;
  type: McpTransportType;
  importMode: 'form' | 'json';
  onNameChange: (name: string) => void;
  onTypeChange: (type: McpTransportType) => void;
}

/**
 * McpServerFormBasicInfo - Server name and transport type fields
 */
export const McpServerFormBasicInfo: React.FC<McpServerFormBasicInfoProps> = ({
  name,
  type,
  importMode,
  onNameChange,
  onTypeChange
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className={importMode === 'json' ? 'md:col-span-2' : ''}>
        <label className="block text-sm font-medium text-foreground mb-2">
          Server Name *
        </label>
        <Input
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
          placeholder="my-server"
          required
        />
      </div>

      {importMode === 'form' && (
        <TransportSelector
          type={type}
          onChange={onTypeChange}
        />
      )}
    </div>
  );
};

export default McpServerFormBasicInfo;
