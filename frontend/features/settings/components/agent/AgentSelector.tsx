/**
 * Agent 选择器组件
 *
 * 用于在 Claude 和 OpenCode 两个 AI 助手之间切换的选择界面
 * 根据设备类型提供不同的渲染方式：
 * - 移动端：水平标签页布局
 * - 桌面端：侧边栏垂直列表布局
 */

// 导入 React 核心库
import React from 'react';
// 导入单个 Agent 选项组件
import { AgentListItem } from './AgentListItem';

// Agent 类型定义
type AgentType = 'claude' | 'opencode';

// Agent 选择器组件属性接口
interface AgentSelectorProps {
  selectedAgent: AgentType;                          // 当前选中的 Agent
  onSelectAgent: (agent: AgentType) => void;         // Agent 选择变更回调函数
}

/**
 * Agent 选择器组件
 * 为移动端和桌面端提供不同的 UI 布局
 */
export const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgent,      // 当前选中的 Agent ID
  onSelectAgent       // Agent 选择处理函数
}) => {
  return (
    <>
      {/* 移动端：水平 Agent 标签页 */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex">
          {/* Claude Agent 标签页 */}
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => onSelectAgent('claude')}
            isMobile={true}
          />
          {/* OpenCode Agent 标签页 */}
          <AgentListItem
            agentId="opencode"
            isSelected={selectedAgent === 'opencode'}
            onClick={() => onSelectAgent('opencode')}
            isMobile={true}
          />
        </div>
      </div>

      {/* 桌面端：侧边栏 - Agent 列表 */}
      <div className="hidden md:block w-48 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-2">
          {/* Claude Agent 列表项 */}
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => onSelectAgent('claude')}
          />
          {/* OpenCode Agent 列表项 */}
          <AgentListItem
            agentId="opencode"
            isSelected={selectedAgent === 'opencode'}
            onClick={() => onSelectAgent('opencode')}
          />
        </div>
      </div>
    </>
  );
};

export default AgentSelector;
