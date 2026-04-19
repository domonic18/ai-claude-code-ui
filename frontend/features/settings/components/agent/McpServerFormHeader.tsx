/**
 * McpServerFormHeader Component
 *
 * Header section of the MCP server form modal.
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

export interface McpServerFormHeaderProps {
  editingServer: boolean;
  onClose: () => void;
}

/**
 * McpServerFormHeader - Modal header with title and close button
 */
export const McpServerFormHeader: React.FC<McpServerFormHeaderProps> = ({
  editingServer,
  onClose
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <h3 className="text-lg font-medium text-foreground">
        {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
      </h3>
      <Button variant="ghost" size="sm" onClick={onClose}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default McpServerFormHeader;
