/**
 * Agent 列表项组件
 *
 * 在 Agent 选择器中显示单个 Agent 选项
 * 根据设备类型提供不同的渲染方式：
 * - 移动端：水平标签页（带底部边框）
 * - 桌面端：侧边栏列表项（带左侧边框）
 *
 * 每个Agent都有特定的颜色主题和 Logo 图标
 *
 * 迁移自：frontend/components/settings/AgentListItem.jsx
 */

// 导入 React 核心库
import React from 'react';
// 导入 Claude 和 OpenCode 的 Logo 图标
import { ClaudeLogo, OpenCodeLogo } from '@/shared/assets/icons';

// Agent ID 类型定义
type AgentId = 'claude' | 'opencode';

// Agent 主题颜色类型定义
type AgentColor = 'blue' | 'green';

// Agent 配置接口：名称、颜色主题和 Logo 组件
interface AgentConfig {
  name: string;                                                   // Agent 显示名称
  color: AgentColor;                                              // 主题颜色
  Logo: React.ComponentType<React.SVGProps<SVGSVGElement>>;      // Logo 组件
}

// Agent 列表项组件属性接口
interface AgentListItemProps {
  agentId: AgentId;            // Agent ID
  isSelected: boolean;         // 是否被选中
  onClick: () => void;         // 点击事件处理函数
  isMobile?: boolean;          // 是否为移动端布局
}

// Agent 配置常量：定义每个 Agent 的名称、颜色和 Logo
const agentConfig: Record<AgentId, AgentConfig> = {
  claude: {
    name: 'Claude',
    color: 'blue',
    Logo: ClaudeLogo,
  },
  opencode: {
    name: 'OpenCode',
    color: 'green',
    Logo: OpenCodeLogo,
  },
};

// 颜色样式映射常量：定义不同颜色的 Tailwind CSS 类名
const colorClasses: Record<AgentColor, {
  border: string;         // 侧边框样式（桌面端）
  borderBottom: string;   // 底部边框样式（移动端）
  bg: string;             // 背景样式
}> = {
  blue: {
    border: 'border-l-blue-500 md:border-l-blue-500',
    borderBottom: 'border-b-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  green: {
    border: 'border-l-green-500 md:border-l-green-500',
    borderBottom: 'border-b-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
  },
};

/**
 * Agent 列表项组件
 * 单个 Agent 选择项，支持移动端和桌面端两种布局
 */
export const AgentListItem: React.FC<AgentListItemProps> = ({
  agentId,            // Agent ID
  isSelected,         // 选中状态
  onClick,            // 点击处理函数
  isMobile = false    // 移动端标志，默认桌面端
}) => {
  // 获取 Agent 配置和对应的颜色样式
  const config = agentConfig[agentId];
  const colors = colorClasses[config.color];
  const { Logo } = config;

  // 移动端：水平布局，底部边框高亮
  if (isMobile) {
    return (
      <button
        onClick={onClick}
        className={`flex-1 text-center py-3 px-2 border-b-2 transition-colors ${
          isSelected
            ? `${colors.borderBottom} ${colors.bg}`  // 选中状态：显示底部边框和背景色
            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'  // 未选中：透明边框
        }`}
      >
        {/* 垂直排列：图标在上，文字在下 */}
        <div className="flex flex-col items-center gap-1">
          <Logo className="w-5 h-5" />
          <span className="text-xs font-medium text-foreground">{config.name}</span>
        </div>
      </button>
    );
  }

  // 桌面端：垂直布局，左侧边框高亮
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-l-4 transition-colors ${
        isSelected
          ? `${colors.border} ${colors.bg}`  // 选中状态：显示左侧边框和背景色
          : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'  // 未选中：透明边框
      }`}
    >
      {/* 水平排列：图标在左，文字在右 */}
      <div className="flex items-center gap-2">
        <Logo className="w-4 h-4" />
        <span className="font-medium text-foreground">{config.name}</span>
      </div>
    </button>
  );
};

export default AgentListItem;
