/**
 * McpServerForm Component
 *
 * Modal form for adding and editing MCP servers.
 * Supports both form input mode and JSON import mode.
 *
 * Features:
 * - Form/JSON import mode toggle
 * - Scope selection (User/Project)
 * - Transport type selection (stdio/SSE/HTTP)
 * - Transport-specific configuration fields
 * - Real-time JSON validation
 * - Environment variables and headers configuration
 */

import React from 'react';
import { McpServer } from '../../types/settings.types';
import { ScopeSelector, Project } from '../common/ScopeSelector';
import { McpServerFormHeader } from './McpServerFormHeader';
import { McpServerFormContent, McpFormData } from './McpServerFormContent';
import { McpServerFormActions } from './McpServerFormActions';

export interface McpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export type { McpFormData };

interface McpServerFormProps {
  show: boolean;
  editingServer: McpServer | null;
  formData: McpFormData;
  projects: Project[];
  loading: boolean;
  jsonValidationError: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormDataChange: (data: McpFormData) => void;
  onValidationErrorChange: (error: string) => void;
  onConfigChange: (key: keyof McpConfig, value: any) => void;
}

/**
 * McpServerForm - Modal form for MCP server configuration
 */
export const McpServerForm: React.FC<McpServerFormProps> = ({
  show,
  editingServer,
  formData,
  projects,
  loading,
  jsonValidationError,
  onClose,
  onSubmit,
  onFormDataChange,
  onValidationErrorChange,
  onConfigChange
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <McpServerFormHeader editingServer={!!editingServer} onClose={onClose} />

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <McpServerFormContent
            editingServer={editingServer}
            formData={formData}
            projects={projects}
            jsonValidationError={jsonValidationError}
            onFormDataChange={onFormDataChange}
            onValidationErrorChange={onValidationErrorChange}
            onConfigChange={onConfigChange}
          />

          <McpServerFormActions
            loading={loading}
            editingServer={!!editingServer}
            onClose={onClose}
          />
        </form>
      </div>
    </div>
  );
};

export default McpServerForm;
