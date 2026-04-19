/**
 * McpServerFormContent Component
 *
 * Main form content including all input fields organized by sections.
 */

import React from 'react';
import { ScopeSelector, Project } from '../common/ScopeSelector';
import { McpTransportType, McpScope, McpServer, McpConfig } from '../../types/settings.types';
import { McpServerFormModeToggle } from './McpServerFormModeToggle';
import { McpServerFormBasicInfo } from './McpServerFormBasicInfo';
import { McpServerFormRawConfig } from './McpServerFormRawConfig';
import { McpServerFormJson } from './McpServerFormJson';
import { McpServerFormTransport } from './McpServerFormTransport';
import { McpServerFormEnv } from './McpServerFormEnv';

export interface McpFormData {
  name: string;
  type: McpTransportType;
  scope: McpScope;
  projectPath: string;
  importMode: 'form' | 'json';
  jsonInput: string;
  config: McpConfig;
  raw?: any;
}

export interface McpServerFormContentProps {
  editingServer: McpServer | null;
  formData: McpFormData;
  projects: Project[];
  jsonValidationError: string;
  onFormDataChange: (data: McpFormData) => void;
  onValidationErrorChange: (error: string) => void;
  onConfigChange: (key: keyof McpConfig, value: any) => void;
}

/**
 * McpServerFormContent - All form sections
 */
export const McpServerFormContent: React.FC<McpServerFormContentProps> = ({
  editingServer,
  formData,
  projects,
  jsonValidationError,
  onFormDataChange,
  onValidationErrorChange,
  onConfigChange
}) => {
  const updateFormData = (updates: Partial<McpFormData>) => {
    onFormDataChange({ ...formData, ...updates });
  };

  const handleScopeChange = (scope: McpScope, projectPath: string) => {
    updateFormData({ scope, projectPath });
  };

  return (
    <>
      {!editingServer && (
        <McpServerFormModeToggle
          importMode={formData.importMode}
          onModeChange={(mode) => updateFormData({ importMode: mode })}
        />
      )}

      {formData.importMode === 'form' && (
        <ScopeSelector
          scope={formData.scope}
          projectPath={formData.projectPath}
          projects={projects}
          readonly={!!editingServer}
          onChange={handleScopeChange}
        />
      )}

      <McpServerFormBasicInfo
        name={formData.name}
        type={formData.type}
        importMode={formData.importMode}
        onNameChange={(name) => updateFormData({ name })}
        onTypeChange={(type) => updateFormData({ type })}
      />

      {editingServer && formData.raw && formData.importMode === 'form' && (
        <McpServerFormRawConfig editingServer={editingServer} rawConfig={formData.raw} />
      )}

      {formData.importMode === 'json' && (
        <McpServerFormJson
          jsonInput={formData.jsonInput}
          validationError={jsonValidationError}
          onChange={(value) => updateFormData({ jsonInput: value })}
          onValidationErrorChange={onValidationErrorChange}
        />
      )}

      {formData.importMode === 'form' && (
        <McpServerFormTransport
          type={formData.type}
          config={formData.config}
          onConfigChange={onConfigChange}
        />
      )}

      {formData.importMode === 'form' && (
        <McpServerFormEnv
          env={formData.config.env}
          onChange={(env) => onConfigChange('env', env)}
        />
      )}
    </>
  );
};

export default McpServerFormContent;
