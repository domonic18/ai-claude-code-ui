/**
 * AgentListItem Component
 *
 * Displays a single agent item in the agent selector.
 * Renders differently for mobile (horizontal tab) and desktop (sidebar item).
 *
 * Migrated from: frontend/components/settings/AgentListItem.jsx
 */

import React from 'react';
import { ClaudeLogo, OpenCodeLogo } from '@/shared/assets/icons';

type AgentId = 'claude' | 'opencode';

type AgentColor = 'blue' | 'green';

interface AgentConfig {
  name: string;
  color: AgentColor;
  Logo: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface AgentListItemProps {
  agentId: AgentId;
  isSelected: boolean;
  onClick: () => void;
  isMobile?: boolean;
}

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

const colorClasses: Record<AgentColor, {
  border: string;
  borderBottom: string;
  bg: string;
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
 * AgentListItem - Single agent selection item
 */
export const AgentListItem: React.FC<AgentListItemProps> = ({
  agentId,
  isSelected,
  onClick,
  isMobile = false
}) => {
  const config = agentConfig[agentId];
  const colors = colorClasses[config.color];
  const { Logo } = config;

  // Mobile: horizontal layout with bottom border
  if (isMobile) {
    return (
      <button
        onClick={onClick}
        className={`flex-1 text-center py-3 px-2 border-b-2 transition-colors ${
          isSelected
            ? `${colors.borderBottom} ${colors.bg}`
            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <Logo className="w-5 h-5" />
          <span className="text-xs font-medium text-foreground">{config.name}</span>
        </div>
      </button>
    );
  }

  // Desktop: vertical layout with left border
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-l-4 transition-colors ${
        isSelected
          ? `${colors.border} ${colors.bg}`
          : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <Logo className="w-4 h-4" />
        <span className="font-medium text-foreground">{config.name}</span>
      </div>
    </button>
  );
};

export default AgentListItem;
