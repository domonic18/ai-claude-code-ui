/**
 * AgentPermissions Component
 *
 * Manages Claude tool permissions (allowed/blocked tools).
 * Provides quick-add buttons for common tools and tool pattern configuration.
 *
 * Migrated from: frontend/components/settings/PermissionsContent.jsx
 * Note: Cursor and Codex variants have been removed as they are no longer supported.
 */

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Shield, AlertTriangle, Plus, X } from 'lucide-react';

// Common tool patterns for Claude
const commonClaudeTools = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch'
];

interface AgentPermissionsProps {
  skipPermissions: boolean;
  setSkipPermissions: (value: boolean) => void;
  allowedTools: string[];
  setAllowedTools: (tools: string[]) => void;
  disallowedTools: string[];
  setDisallowedTools: (tools: string[]) => void;
  newAllowedTool: string;
  setNewAllowedTool: (value: string) => void;
  newDisallowedTool: string;
  setNewDisallowedTool: (value: string) => void;
}

/**
 * AgentPermissions - Claude tool permissions configuration
 */
const AgentPermissions: React.FC<AgentPermissionsProps> = ({
  skipPermissions,
  setSkipPermissions,
  allowedTools,
  setAllowedTools,
  disallowedTools,
  setDisallowedTools,
  newAllowedTool,
  setNewAllowedTool,
  newDisallowedTool,
  setNewDisallowedTool
}) => {
  const addAllowedTool = (tool: string) => {
    if (tool && !allowedTools.includes(tool)) {
      setAllowedTools([...allowedTools, tool]);
      setNewAllowedTool('');
    }
  };

  const removeAllowedTool = (tool: string) => {
    setAllowedTools(allowedTools.filter(t => t !== tool));
  };

  const addDisallowedTool = (tool: string) => {
    if (tool && !disallowedTools.includes(tool)) {
      setDisallowedTools([...disallowedTools, tool]);
      setNewDisallowedTool('');
    }
  };

  const removeDisallowedTool = (tool: string) => {
    setDisallowedTools(disallowedTools.filter(t => t !== tool));
  };

  return (
    <div className="space-y-6">
      {/* Skip Permissions */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-medium text-foreground">
            Permission Settings
          </h3>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={skipPermissions}
              onChange={(e) => setSkipPermissions(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div>
              <div className="font-medium text-orange-900 dark:text-orange-100">
                Skip permission prompts (use with caution)
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">
                Equivalent to --dangerously-skip-permissions flag
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Allowed Tools */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-medium text-foreground">
            Allowed Tools
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Tools that are automatically allowed without prompting for permission
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newAllowedTool}
            onChange={(e) => setNewAllowedTool(e.target.value)}
            placeholder='e.g., "Bash(git log:*)" or "Write"'
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAllowedTool(newAllowedTool);
              }
            }}
            className="flex-1 h-10"
          />
          <Button
            onClick={() => addAllowedTool(newAllowedTool)}
            disabled={!newAllowedTool}
            size="sm"
            className="h-10 px-4"
          >
            <Plus className="w-4 h-4 mr-2 sm:mr-0" />
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Quick add buttons */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick add common tools:
          </p>
          <div className="flex flex-wrap gap-2">
            {commonClaudeTools.map(tool => (
              <Button
                key={tool}
                variant="outline"
                size="sm"
                onClick={() => addAllowedTool(tool)}
                disabled={allowedTools.includes(tool)}
                className="text-xs h-8"
              >
                {tool}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {allowedTools.map(tool => (
            <div key={tool} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <span className="font-mono text-sm text-green-800 dark:text-green-200">
                {tool}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAllowedTool(tool)}
                className="text-green-600 hover:text-green-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {allowedTools.length === 0 && (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              No allowed tools configured
            </div>
          )}
        </div>
      </div>

      {/* Disallowed Tools */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-medium text-foreground">
            Blocked Tools
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Tools that are automatically blocked without prompting for permission
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newDisallowedTool}
            onChange={(e) => setNewDisallowedTool(e.target.value)}
            placeholder='e.g., "Bash(rm:*)"'
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDisallowedTool(newDisallowedTool);
              }
            }}
            className="flex-1 h-10"
          />
          <Button
            onClick={() => addDisallowedTool(newDisallowedTool)}
            disabled={!newDisallowedTool}
            size="sm"
            className="h-10 px-4"
          >
            <Plus className="w-4 h-4 mr-2 sm:mr-0" />
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        <div className="space-y-2">
          {disallowedTools.map(tool => (
            <div key={tool} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <span className="font-mono text-sm text-red-800 dark:text-red-200">
                {tool}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeDisallowedTool(tool)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {disallowedTools.length === 0 && (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              No blocked tools configured
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Tool Pattern Examples:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git log:*)"</code> - Allow all git log commands</li>
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(git diff:*)"</code> - Allow all git diff commands</li>
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Write"</code> - Allow all Write tool usage</li>
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">"Bash(rm:*)"</code> - Block all rm commands (dangerous)</li>
        </ul>
      </div>
    </div>
  );
};

// Main component
export default AgentPermissions;
