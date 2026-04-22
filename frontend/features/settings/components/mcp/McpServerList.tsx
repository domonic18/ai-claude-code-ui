/**
 * McpServerList Component
 *
 * Displays and manages MCP servers for Claude agent.
 * Provides list view, add/edit/delete actions, test functionality, and tools discovery.
 *
 * Migrated from: frontend/components/settings/McpServersContent.jsx
 * Note: Cursor and Codex variants have been removed as they are no longer supported.
 */

// 导入 React 核心库
import React from 'react';
// 导入国际化 Hook
import { useTranslation } from 'react-i18next';
// 导入按钮组件
import { Button } from '@/shared/components/ui/Button';
// 导入图标组件
import { Server, Plus } from 'lucide-react';
// 导入类型定义
import { McpServer } from '../../types/settings.types';
// 导入 MCP 服务器卡片组件
import { McpServerCard } from './McpServerCard';

// Agent 设置页面中的 MCP 服务器列表组件，用于显示和管理 MCP 服务器
interface McpServerListProps {
  agent: string;                                           // Agent 类型
  servers: McpServer[];                                    // 服务器列表
  onAdd: () => void;                                       // 添加服务器回调
  onEdit: (server: McpServer) => void;                    // 编辑服务器回调
  onDelete: (serverId: string) => void;                   // 删除服务器回调
  onTest: (serverId: string, scope: string) => void;      // 测试服务器回调
  onDiscoverTools: (serverId: string, scope: string) => void;  // 发现工具回调
  testResults: Record<string, any>;                        // 测试结果映射
  serverTools: Record<string, any>;                        // 服务器工具映射
  toolsLoading: Record<string, boolean>;                   // 工具加载状态映射
}

/**
 * McpServerList - Main MCP servers management interface
 */
// MCP 服务器列表主组件，用于管理 MCP 服务器
export const McpServerList: React.FC<McpServerListProps> = ({
  servers,
  onAdd,
  onEdit,
  onDelete,
  onTest,
  onDiscoverTools,
  testResults,
  serverTools,
  toolsLoading
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 区域标题：服务器图标和标题 */}
      <div className="flex items-center gap-3">
        <Server className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-medium text-foreground">
          {t('mcp.title')}
        </h3>
      </div>
      {/* 区域说明文字 */}
      <p className="text-sm text-muted-foreground">
        {t('mcp.description')}
      </p>

      {/* 添加服务器按钮 */}
      <div className="flex justify-between items-center">
        <Button
          onClick={onAdd}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('mcp.addServer')}
        </Button>
      </div>

      {/* 服务器列表或空状态 */}
      <div className="space-y-2">
        {servers.map(server => (
          <McpServerCard
            key={server.id}
            server={server}
            testResult={testResults?.[server.id]}
            serverTools={serverTools?.[server.id]}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {servers.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('mcp.noServers')}
          </div>
        )}
      </div>
    </div>
  );
};

export default McpServerList;
