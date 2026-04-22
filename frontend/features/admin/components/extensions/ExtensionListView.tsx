/**
 * ExtensionListView - Renders the grid of extension type list cards
 *
 * @module features/admin/components/extensions/ExtensionListView
 */

import React from 'react';
import { ExtensionListCard } from './ExtensionListCard';
import type { ExtensionsData } from './types';

interface ExtensionListViewProps {
  extensions: ExtensionsData;
}

/**
 * 扩展列表网格视图组件
 * 将五类扩展（agents/commands/skills/hooks/knowledge）各自渲染为一张 ExtensionListCard
 */
export function ExtensionListView({ extensions }: ExtensionListViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {/* Agent 扩展列表：展示名称、描述和来源文件 */}
      <ExtensionListCard
        title="Agents"
        availableLabel="个可用"
        emptyMessage="暂无 Agent"
        items={extensions.agents as unknown as Record<string, string>[]}
        keyField="name"
        renderItem={(agent) => (
          <>
            <div className="font-medium text-foreground">{agent.name}</div>
            <div className="text-muted-foreground text-xs mt-1">{agent.description}</div>
            <div className="text-muted-foreground/60 text-xs mt-1">{agent.filename}</div>
          </>
        )}
      />

      {/* Command 扩展列表：展示斜杠命令名和来源文件 */}
      <ExtensionListCard
        title="Commands"
        availableLabel="个可用"
        emptyMessage="暂无 Command"
        items={extensions.commands as unknown as Record<string, string>[]}
        keyField="name"
        renderItem={(cmd) => (
          <div className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors">
            <span className="font-mono text-foreground">/{cmd.name}</span>
            <div className="text-muted-foreground/60 text-xs mt-1">{cmd.filename}</div>
          </div>
        )}
      />

      {/* Skill 扩展列表：展示技能名称和描述 */}
      <ExtensionListCard
        title="Skills"
        availableLabel="个可用"
        emptyMessage="暂无 Skill"
        items={extensions.skills as unknown as Record<string, string>[]}
        keyField="name"
        renderItem={(skill) => (
          <>
            <div className="font-medium text-foreground">{skill.name}</div>
            <div className="text-muted-foreground text-xs mt-1">{skill.description}</div>
          </>
        )}
      />

      {/* Hook 扩展列表：展示钩子名称、类型标签和描述 */}
      <ExtensionListCard
        title="Hooks"
        availableLabel="个可用"
        emptyMessage="暂无 Hook"
        items={(extensions.hooks || []) as unknown as Record<string, string>[]}
        keyField="name"
        renderItem={(hook) => (
          <div className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{hook.name}</span>
              <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded">
                {hook.type}
              </span>
            </div>
            <div className="text-muted-foreground text-xs mt-1 line-clamp-2">{hook.description}</div>
            <div className="text-muted-foreground/60 text-xs mt-1">{hook.filename}</div>
          </div>
        )}
      />

      {/* Knowledge 扩展列表：展示知识库名称、类型标签和描述 */}
      <ExtensionListCard
        title="Knowledge"
        availableLabel="个可用"
        emptyMessage="暂无知识库"
        items={(extensions.knowledge || []) as unknown as Record<string, string>[]}
        keyField="name"
        renderItem={(knowledge) => (
          <div className="text-sm py-2 px-3 bg-muted hover:bg-accent rounded-md transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{knowledge.name}</span>
              <span className="text-xs px-1.5 py-0.5 bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded">
                {knowledge.type}
              </span>
            </div>
            <div className="text-muted-foreground text-xs mt-1 line-clamp-2">{knowledge.description}</div>
            <div className="text-muted-foreground/60 text-xs mt-1">{knowledge.filename}</div>
          </div>
        )}
      />
    </div>
  );
}
