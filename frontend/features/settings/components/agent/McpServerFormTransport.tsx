/**
 * McpServerFormTransport Component
 *
 * Transport-specific configuration fields based on transport type.
 * Renders stdio, SSE, or HTTP configuration depending on the type.
 */

import React from 'react';
import { McpTransportType, McpConfig } from '../../types/settings.types';
import { McpServerFormStdio } from './McpServerFormStdio';
import { McpServerFormHttp } from './McpServerFormHttp';

export interface McpServerFormTransportProps {
  type: McpTransportType;
  config: McpConfig;
  onConfigChange: (key: keyof McpConfig, value: any) => void;
}

/**
 * McpServerFormTransport - Transport-specific configuration
 */
export const McpServerFormTransport: React.FC<McpServerFormTransportProps> = ({
  type,
  config,
  onConfigChange
}) => {
  if (type === 'stdio') {
    return (
      <McpServerFormStdio
        command={config.command}
        args={config.args}
        onCommandChange={(command) => onConfigChange('command', command)}
        onArgsChange={(args) => onConfigChange('args', args)}
      />
    );
  }

  if (type === 'sse' || type === 'http') {
    return (
      <McpServerFormHttp
        url={config.url}
        headers={config.headers}
        onUrlChange={(url) => onConfigChange('url', url)}
        onHeadersChange={(headers) => onConfigChange('headers', headers)}
      />
    );
  }

  return null;
};

export default McpServerFormTransport;
