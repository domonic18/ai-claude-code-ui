/**
 * McpServerFormEnv Component
 *
 * Environment variables configuration field for MCP servers.
 * Provides a textarea for KEY=value pairs.
 */

import React from 'react';

export interface McpServerFormEnvProps {
  env?: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}

/**
 * McpServerFormEnv - Environment variables configuration
 */
export const McpServerFormEnv: React.FC<McpServerFormEnvProps> = ({
  env = {},
  onChange
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const envObj: Record<string, string> = {};
    e.target.value.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim()) {
        envObj[key.trim()] = valueParts.join('=').trim();
      }
    });
    onChange(envObj);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Environment Variables (KEY=value, one per line)
      </label>
      <textarea
        value={Object.entries(env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
        rows={3}
        placeholder={`API_KEY=your-key
DEBUG=true`}
      />
    </div>
  );
};

export default McpServerFormEnv;
