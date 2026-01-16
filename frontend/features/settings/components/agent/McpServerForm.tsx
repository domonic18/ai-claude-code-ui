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

import React, { useState } from 'react';
import { X, Globe, FolderOpen } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { ScopeSelector, Project } from '../common/ScopeSelector';
import { TransportSelector } from '../common/TransportSelector';
import { McpServer, McpTransportType, McpScope } from '../../types/settings.types';

export interface McpConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

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

  const updateFormData = (updates: Partial<McpFormData>) => {
    onFormDataChange({ ...formData, ...updates });
  };

  const updateMcpConfig = (key: keyof McpConfig, value: any) => {
    onConfigChange(key, value);
  };

  const handleScopeChange = (scope: McpScope, projectPath: string) => {
    updateFormData({ scope, projectPath });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-medium text-foreground">
            {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {/* Import Mode Toggle */}
          {!editingServer && (
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => updateFormData({ importMode: 'form' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  formData.importMode === 'form'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Form Input
              </button>
              <button
                type="button"
                onClick={() => updateFormData({ importMode: 'json' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  formData.importMode === 'json'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                JSON Import
              </button>
            </div>
          )}

          {/* Scope Selector */}
          {formData.importMode === 'form' && (
            <ScopeSelector
              scope={formData.scope}
              projectPath={formData.projectPath}
              projects={projects}
              readonly={!!editingServer}
              onChange={handleScopeChange}
            />
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={formData.importMode === 'json' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-foreground mb-2">
                Server Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  updateFormData({ name: e.target.value });
                }}
                placeholder="my-server"
                required
              />
            </div>

            {formData.importMode === 'form' && (
              <TransportSelector
                type={formData.type}
                onChange={(type) => updateFormData({ type })}
              />
            )}
          </div>

          {/* Show raw configuration when editing */}
          {editingServer && formData.raw && formData.importMode === 'form' && (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">
                Configuration Details (from {editingServer.scope === 'user' ? '~/.claude.json' : 'project config'})
              </h4>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
                {JSON.stringify(formData.raw, null, 2)}
              </pre>
            </div>
          )}

          {/* JSON Import Mode */}
          {formData.importMode === 'json' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  JSON Configuration *
                </label>
                <textarea
                  value={formData.jsonInput}
                  onChange={(e) => {
                    updateFormData({ jsonInput: e.target.value });
                    // Validate JSON as user types
                    try {
                      if (e.target.value.trim()) {
                        const parsed = JSON.parse(e.target.value);
                        if (!parsed.type) {
                          onValidationErrorChange('Missing required field: type');
                        } else if (parsed.type === 'stdio' && !parsed.command) {
                          onValidationErrorChange('stdio type requires a command field');
                        } else if ((parsed.type === 'http' || parsed.type === 'sse') && !parsed.url) {
                          onValidationErrorChange(`${parsed.type} type requires a url field`);
                        } else {
                          onValidationErrorChange('');
                        }
                      }
                    } catch (err) {
                      if (e.target.value.trim()) {
                        onValidationErrorChange('Invalid JSON format');
                      } else {
                        onValidationErrorChange('');
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 border ${jsonValidationError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500`}
                  rows={8}
                  placeholder={`{
  "type": "stdio",
  "command": "/path/to/server",
  "args": ["--api-key", "abc123"],
  "env": {
    "CACHE_DIR": "/tmp"
  }
}`}
                  required
                />
                {jsonValidationError && (
                  <p className="text-xs text-red-500 mt-1">{jsonValidationError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Paste your MCP server configuration in JSON format. Example formats:
                  <br />• stdio: {`{"type":"stdio","command":"npx","args":["@upstash/context7-mcp"]}`}
                  <br />• http/sse: {`{"type":"http","url":"https://api.example.com/mcp"}`}
                </p>
              </div>
            </div>
          )}

          {/* Transport-specific Config - stdio */}
          {formData.importMode === 'form' && formData.type === 'stdio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Command *
                </label>
                <Input
                  value={formData.config.command}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMcpConfig('command', e.target.value)}
                  placeholder="/path/to/mcp-server"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Arguments (one per line)
                </label>
                <textarea
                  value={Array.isArray(formData.config.args) ? formData.config.args.join('\n') : ''}
                  onChange={(e) => updateMcpConfig('args', e.target.value.split('\n').filter(arg => arg.trim()))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                  rows={3}
                  placeholder={`--api-key
abc123`}
                />
              </div>
            </div>
          )}

          {/* Transport-specific Config - SSE/HTTP */}
          {formData.importMode === 'form' && (formData.type === 'sse' || formData.type === 'http') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                URL *
              </label>
              <Input
                value={formData.config.url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMcpConfig('url', e.target.value)}
                placeholder="https://api.example.com/mcp"
                type="url"
                required
              />
            </div>
          )}

          {/* Environment Variables */}
          {formData.importMode === 'form' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Environment Variables (KEY=value, one per line)
              </label>
              <textarea
                value={Object.entries(formData.config.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const env: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split('=');
                    if (key && key.trim()) {
                      env[key.trim()] = valueParts.join('=').trim();
                    }
                  });
                  updateMcpConfig('env', env);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                rows={3}
                placeholder={`API_KEY=your-key
DEBUG=true`}
              />
            </div>
          )}

          {/* Headers for SSE/HTTP */}
          {formData.importMode === 'form' && (formData.type === 'sse' || formData.type === 'http') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Headers (KEY=value, one per line)
              </label>
              <textarea
                value={Object.entries(formData.config.headers || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const headers: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...valueParts] = line.split('=');
                    if (key && key.trim()) {
                      headers[key.trim()] = valueParts.join('=').trim();
                    }
                  });
                  updateMcpConfig('headers', headers);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                rows={3}
                placeholder={`Authorization=Bearer token
X-API-Key=your-key`}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (editingServer ? 'Update Server' : 'Add Server')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default McpServerForm;
