/**
 * ScopeSelector Component
 *
 * Allows users to select between User (Global) and Project (Local) scope for MCP servers.
 * When Project scope is selected, shows a project selector dropdown.
 *
 * Note: UI uses "local" terminology but backend uses "project"
 */

import React from 'react';
import { Globe, FolderOpen } from 'lucide-react';
import { McpScope } from '../../types/settings.types';

// UI-facing type (user-facing terminology)
type UiScope = 'user' | 'local';

export interface Project {
  name: string;
  path?: string;
  fullPath?: string;
  displayName?: string;
}

interface ScopeSelectorProps {
  scope: McpScope;
  projectPath: string;
  projects: Project[];
  readonly?: boolean;
  onChange: (scope: McpScope, projectPath: string) => void;
}

// Helper to convert backend scope to UI scope
const toUiScope = (scope: McpScope): UiScope => {
  return scope === 'project' ? 'local' : scope;
};

// Helper to convert UI scope to backend scope
const fromUiScope = (scope: UiScope): McpScope => {
  return scope === 'local' ? 'project' : scope;
};

/**
 * ScopeSelector - Provides scope selection UI for MCP servers
 */
export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  scope,
  projectPath,
  projects,
  readonly = false,
  onChange
}) => {
  const uiScope = toUiScope(scope);

  const handleChange = (newUiScope: UiScope, newProjectPath: string) => {
    onChange(fromUiScope(newUiScope), newProjectPath);
  };

  if (readonly) {
    // Display-only mode for editing existing servers
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <label className="block text-sm font-medium text-foreground mb-2">
          Scope
        </label>
        <div className="flex items-center gap-2">
          {scope === 'user' ? <Globe className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
          <span className="text-sm">
            {scope === 'user' ? 'User (Global)' : 'Project (Local)'}
          </span>
          {scope === 'project' && projectPath && (
            <span className="text-xs text-muted-foreground">
              - {projectPath}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Scope cannot be changed when editing an existing server
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Scope *
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleChange('user', '')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              uiScope === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Globe className="w-4 h-4" />
              <span>User (Global)</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleChange('local', '')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              uiScope === 'local'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span>Project (Local)</span>
            </div>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {uiScope === 'user'
            ? 'User scope: Available across all projects on your machine'
            : 'Local scope: Only available in the selected project'
          }
        </p>
      </div>

      {/* Project Selection for Local Scope */}
      {uiScope === 'local' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Project *
          </label>
          <select
            value={projectPath}
            onChange={(e) => handleChange('local', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a project...</option>
            {projects.map(project => (
              <option key={project.name} value={project.path || project.fullPath}>
                {project.displayName || project.name}
              </option>
            ))}
          </select>
          {projectPath && (
            <p className="text-xs text-muted-foreground mt-1">
              Path: {projectPath}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ScopeSelector;
