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
 * 扩展预置管理主组件
 * 加载 → 错误/空态 → 展示统计卡片 + 同步操作 + 五类扩展列表
 */
export function ExtensionManagement() {
  // 从自定义 Hook 获取扩展数据、加载状态、同步状态和操作方法
  // extensions: 五类扩展的数据对象
  // loading: 初始加载状态
  // syncing: 同步操作进行中状态
  // syncResults: 最近一次同步的结果对象
  // error: 错误信息字符串
  // fetchExtensions: 重新拉取扩展数据的函数
  // syncToAll: 触发同步到所有用户的函数
  const { extensions, loading, syncing, syncResults, error, fetchExtensions, syncToAll } =
    useExtensionsApi();

  // 加载中态：旋转图标 + 提示文字
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          {/* 旋转的刷新图标，使用主题色 */}
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          {/* 加载提示文字 */}
          <p className="text-muted-foreground">加载扩展中...</p>
        </div>
      </div>
    );
  }

  // 错误态：展示错误信息和重试按钮，点击重新调用 fetchExtensions
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          {/* 红色警告图标 */}
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          {/* 错误标题 */}
          <h3 className="text-lg font-semibold text-foreground mb-2">加载失败</h3>
          {/* 具体错误信息 */}
          <p className="text-muted-foreground mb-4">{error}</p>
          {/* 点击重试，重新请求 /api/extensions */}
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

  // 无数据时返回 null，不渲染任何内容
  if (!extensions) {
    return null;
  }

  // 主视图：标题栏 + 五类扩展统计卡片 + 同步操作区 + 扩展列表
  return (
    <div className="p-6 space-y-6">
      {/* 页面标题栏，右侧刷新按钮手动拉取最新扩展数据 */}
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

      {/* 五类扩展的统计卡片：agents/commands/skills/hooks/knowledge 各一张 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ExtensionStatCard label="Agents" count={extensions.agents.length} icon="🤖" color="blue" />
        <ExtensionStatCard label="Commands" count={extensions.commands.length} icon="⚡" color="green" />
        <ExtensionStatCard label="Skills" count={extensions.skills.length} icon="🎯" color="purple" />
        <ExtensionStatCard label="Hooks" count={extensions.hooks?.length || 0} icon="🪝" color="orange" />
        <ExtensionStatCard label="Knowledge" count={extensions.knowledge?.length || 0} icon="📚" color="teal" />
      </div>

      {/* 同步操作区：包含"保留用户文件同步"和"强制覆盖同步"两个按钮 */}
      <SyncActions syncing={syncing} syncResults={syncResults} onSync={syncToAll} />

      {/* 扩展列表区：按五类分组展示每条扩展的名称、描述、来源文件 */}
      <ExtensionListView extensions={extensions} />
    </div>
  );
}

export default ExtensionManagement;
