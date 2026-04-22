/**
 * McpServerCard Component
 *
 * Displays a single MCP server with its configuration, test results, and tools.
 * Provides edit and delete actions.
 *
 * Extracted from McpServersContent for better modularity.
 */

// 导入 React 核心库
import React from 'react';
// 导入 UI 组件
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
// 导入图标组件
import { Server, Terminal, Globe, Zap, Edit3, Trash2 } from 'lucide-react';
// 导入类型定义
import { McpServer, McpTransportType } from '../../types/settings.types';

// MCP 服务器卡片组件属性接口
interface McpServerCardProps {
  server: McpServer;                           // MCP 服务器对象
  testResult?: any;                            // 测试结果
  serverTools?: any;                           // 服务器工具列表
  onEdit: (server: McpServer) => void;         // 编辑回调
  onDelete: (serverId: string) => void;        // 删除回调
}

// 根据传输类型获取对应图标
const getTransportIcon = (type: McpTransportType) => {
  switch (type) {
    case 'stdio': return <Terminal className="w-4 h-4" />;
    case 'sse': return <Zap className="w-4 h-4" />;
    case 'http': return <Globe className="w-4 h-4" />;
    default: return <Server className="w-4 h-4" />;
  }
};

// 将后端 scope 转换为 UI 显示的辅助函数
const toUiScope = (scope: 'user' | 'project'): 'user' | 'local' => {
  return scope === 'project' ? 'local' : scope;
};

/**
 * Get server configuration display
 */
function ServerConfigDisplay({ server }: { server: McpServer }) {
  if (server.type === 'stdio' && server.config?.command) {
    return <div>Command: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.command}</code></div>;
  }

  if ((server.type === 'sse' || server.type === 'http') && server.config?.url) {
    return <div>URL: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.url}</code></div>;
  }

  if (server.config?.args && server.config.args.length > 0) {
    return <div>Args: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{server.config.args.join(' ')}</code></div>;
  }

  return null;
}

/**
 * Get test result styling
 */
function getTestResultClassNames(success: boolean): string {
  const baseClasses = 'mt-2 p-2 rounded text-xs';
  const colorClasses = success
    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200';
  return `${baseClasses} ${colorClasses}`;
}

/**
 * Test result display component
 */
function TestResultDisplay({ testResult }: { testResult: any }) {
  if (!testResult) return null;

  return (
    <div className={getTestResultClassNames(testResult.success)}>
      <div className="font-medium">{testResult.message}</div>
    </div>
  );
}

/**
 * Tools discovery display component
 */
function ToolsDisplay({ serverTools }: { serverTools: any }) {
  if (!serverTools?.tools || serverTools.tools.length === 0) return null;

  const tools = serverTools.tools;
  const displayTools = tools.slice(0, 5);
  const remainingCount = tools.length - 5;

  return (
    <div className="mt-2 p-2 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
      <div className="font-medium">Tools ({tools.length}):</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {displayTools.map((tool: any, i: number) => (
          <code key={i} className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{tool.name}</code>
        ))}
        {remainingCount > 0 && (
          <span className="text-xs opacity-75">+{remainingCount} more</span>
        )}
      </div>
    </div>
  );
}

/**
 * Action buttons component
 */
function ServerActions({ server, onEdit, onDelete }: { server: McpServer; onEdit: (server: McpServer) => void; onDelete: (serverId: string) => void }) {
  return (
    <div className="flex items-center gap-2 ml-4">
      <Button
        onClick={() => onEdit(server)}
        variant="ghost"
        size="sm"
        className="text-gray-600 hover:text-gray-700"
        title="Edit server"
      >
        <Edit3 className="w-4 h-4" />
      </Button>
      <Button
        onClick={() => onDelete(server.id)}
        variant="ghost"
        size="sm"
        className="text-red-600 hover:text-red-700"
        title="Delete server"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

/**
 * McpServerCard - Single MCP server display card
 */
export const McpServerCard: React.FC<McpServerCardProps> = ({
  server,
  testResult,
  serverTools,
  onEdit,
  onDelete
}) => {
  const uiScope = toUiScope(server.scope);

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getTransportIcon(server.type)}
            <span className="font-medium text-foreground">{server.name}</span>
            <Badge variant="outline" className="text-xs">{server.type}</Badge>
            <Badge variant="outline" className="text-xs">{uiScope}</Badge>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <ServerConfigDisplay server={server} />
          </div>

          <TestResultDisplay testResult={testResult} />
          <ToolsDisplay serverTools={serverTools} />
        </div>

        <ServerActions server={server} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
};

export default McpServerCard;
