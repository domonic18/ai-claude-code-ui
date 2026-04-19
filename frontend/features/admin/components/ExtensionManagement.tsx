/**
 * ExtensionManagement Component
 *
 * Admin interface for managing pre-configured extensions (agents, commands, skills, hooks, knowledge).
 * Provides functionality to view available extensions and sync them to all users.
 *
 * @module features/admin/components/ExtensionManagement
 */

import { RefreshCw, AlertCircle } from 'lucide-react';
import { ExtensionStatCard } from './extensions/ExtensionStatCard';
import { ExtensionListView } from './extensions/ExtensionListView';
import { SyncActions } from './extensions/SyncActions';
import { useExtensionsApi } from './extensions/useExtensionsApi';

/**
 * ExtensionManagement Component
 */
export function ExtensionManagement() {
  const { extensions, loading, syncing, syncResults, error, fetchExtensions, syncToAll } =
    useExtensionsApi();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">加载扩展中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground mb-2">加载失败</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchExtensions}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!extensions) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">扩展预置管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理和同步预置的 agents、commands、skills、hooks 和 knowledge 到所有用户
          </p>
        </div>
        <button
          onClick={fetchExtensions}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          title="刷新列表"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ExtensionStatCard label="Agents" count={extensions.agents.length} icon="🤖" color="blue" />
        <ExtensionStatCard label="Commands" count={extensions.commands.length} icon="⚡" color="green" />
        <ExtensionStatCard label="Skills" count={extensions.skills.length} icon="🎯" color="purple" />
        <ExtensionStatCard label="Hooks" count={extensions.hooks?.length || 0} icon="🪝" color="orange" />
        <ExtensionStatCard label="Knowledge" count={extensions.knowledge?.length || 0} icon="📚" color="teal" />
      </div>

      {/* Sync Actions */}
      <SyncActions syncing={syncing} syncResults={syncResults} onSync={syncToAll} />

      {/* Extensions List */}
      <ExtensionListView extensions={extensions} />
    </div>
  );
}

export default ExtensionManagement;
