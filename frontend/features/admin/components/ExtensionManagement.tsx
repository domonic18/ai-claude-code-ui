/**
 * ExtensionManagement Component
 *
 * Admin interface for managing pre-configured extensions (agents, commands, skills, hooks, knowledge).
 * Provides functionality to view available extensions and sync them to all users.
 *
 * @module features/admin/components/ExtensionManagement
 */

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

/**
 * Extension data types
 */
interface Agent {
  filename: string;
  name: string;
  description: string;
}

interface Command {
  filename: string;
  name: string;
}

interface Skill {
  name: string;
  description: string;
}

interface Hook {
  filename: string;
  name: string;
  type: string;
  description: string;
}

interface Knowledge {
  filename: string;
  name: string;
  type: string;
  description: string;
}

interface ExtensionsData {
  agents: Agent[];
  commands: Command[];
  skills: Skill[];
  hooks?: Hook[];
  knowledge?: Knowledge[];
}

interface SyncResults {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ userId: number; username: string; error: string }>;
}

/**
 * ExtensionManagement Component
 */
export function ExtensionManagement() {
  const [extensions, setExtensions] = useState<ExtensionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all available extensions
   */
  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extensions');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch extensions');
      }

      setExtensions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch extensions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sync extensions to all users
   */
  const syncToAll = useCallback(async (overwriteUserFiles = false) => {
    setSyncing(true);
    setError(null);
    setSyncResults(null);

    try {
      const response = await fetch('/api/extensions/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwriteUserFiles })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync extensions');
      }

      setSyncResults(data.data);

      // Refresh extensions list after sync
      await fetchExtensions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to sync extensions:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchExtensions]);

  // Load extensions on mount
  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

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
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border border-blue-500/20 dark:border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Agents</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{extensions.agents.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 dark:bg-blue-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border border-green-500/20 dark:border-green-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Commands</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">{extensions.commands.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 dark:bg-green-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border border-purple-500/20 dark:border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Skills</p>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">{extensions.skills.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 dark:bg-purple-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20 border border-orange-500/20 dark:border-orange-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Hooks</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">{extensions.hooks?.length || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange-500/20 dark:bg-orange-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">🪝</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500/10 to-teal-600/10 dark:from-teal-500/20 dark:to-teal-600/20 border border-teal-500/20 dark:border-teal-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Knowledge</p>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">{extensions.knowledge?.length || 0}</p>
            </div>
            <div className="w-12 h-12 bg-teal-500/20 dark:bg-teal-500/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">同步操作</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => syncToAll(false)}
            disabled={syncing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground transition-colors flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                同步到所有用户（保留用户文件）
              </>
            )}
          </button>

          <button
            onClick={() => syncToAll(true)}
            disabled={syncing}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground transition-colors flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                强制覆盖所有用户文件
              </>
            )}
          </button>
        </div>

        {/* Sync Results */}
        {syncResults && (
          <div className="mt-4 p-4 bg-muted border border-border rounded-md">
            <div className="flex items-center gap-2 mb-2">
              {syncResults.failed === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <span className="font-medium text-foreground">
                同步完成：{syncResults.synced}/{syncResults.total} 用户成功
              </span>
            </div>
            {syncResults.failed > 0 && (
              <div className="mt-2">
                <p className="text-sm text-destructive font-medium mb-1">失败的用户：</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {syncResults.errors.map((err, idx) => (
                    <li key={idx}>
                      用户 {err.userId} ({err.username}): {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extensions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Agents */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Agents</h2>
            <p className="text-sm text-muted-foreground">{extensions.agents.length} 个可用</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {extensions.agents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无 Agent</p>
            ) : (
              <ul className="space-y-3">
                {extensions.agents.map((agent) => (
                  <li key={agent.name} className="text-sm">
                    <div className="font-medium text-foreground">{agent.name}</div>
                    <div className="text-muted-foreground text-xs mt-1">{agent.description}</div>
                    <div className="text-muted-foreground/60 text-xs mt-1">{agent.filename}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Commands */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Commands</h2>
            <p className="text-sm text-muted-foreground">{extensions.commands.length} 个可用</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {extensions.commands.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无 Command</p>
            ) : (
              <ul className="space-y-2">
                {extensions.commands.map((cmd) => (
                  <li
                    key={cmd.name}
                    className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors"
                  >
                    <span className="font-mono text-foreground">/{cmd.name}</span>
                    <div className="text-muted-foreground/60 text-xs mt-1">{cmd.filename}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Skills</h2>
            <p className="text-sm text-muted-foreground">{extensions.skills.length} 个可用</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {extensions.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无 Skill</p>
            ) : (
              <ul className="space-y-3">
                {extensions.skills.map((skill) => (
                  <li key={skill.name} className="text-sm">
                    <div className="font-medium text-foreground">{skill.name}</div>
                    <div className="text-muted-foreground text-xs mt-1">{skill.description}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Hooks */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Hooks</h2>
            <p className="text-sm text-muted-foreground">{extensions.hooks?.length || 0} 个可用</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {!extensions.hooks || extensions.hooks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无 Hook</p>
            ) : (
              <ul className="space-y-2">
                {extensions.hooks.map((hook) => (
                  <li
                    key={hook.name}
                    className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{hook.name}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded">
                        {hook.type}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs mt-1 line-clamp-2">{hook.description}</div>
                    <div className="text-muted-foreground/60 text-xs mt-1">{hook.filename}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Knowledge */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Knowledge</h2>
            <p className="text-sm text-muted-foreground">{extensions.knowledge?.length || 0} 个可用</p>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {!extensions.knowledge || extensions.knowledge.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无知识库</p>
            ) : (
              <ul className="space-y-2">
                {extensions.knowledge.map((knowledge) => (
                  <li
                    key={knowledge.name}
                    className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{knowledge.name}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded">
                        {knowledge.type}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs mt-1 line-clamp-2">{knowledge.description}</div>
                    <div className="text-muted-foreground/60 text-xs mt-1">{knowledge.filename}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExtensionManagement;
