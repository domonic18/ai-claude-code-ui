/**
 * AgentSelector Component
 *
 * Displays agent selection tabs/buttons for switching between Claude and OpenCode.
 * Renders differently for mobile (horizontal tabs) and desktop (sidebar).
 */

import React from 'react';
import { AgentListItem } from './AgentListItem';

type AgentType = 'claude' | 'opencode';

interface AgentSelectorProps {
  selectedAgent: AgentType;
  onSelectAgent: (agent: AgentType) => void;
}

/**
 * AgentSelector - Provides agent selection UI for both mobile and desktop layouts
 */
export const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgent,
  onSelectAgent
}) => {
  return (
    <>
      {/* Mobile: Horizontal Agent Tabs */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex">
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => onSelectAgent('claude')}
            isMobile={true}
          />
          <AgentListItem
            agentId="opencode"
            isSelected={selectedAgent === 'opencode'}
            onClick={() => onSelectAgent('opencode')}
            isMobile={true}
          />
        </div>
      </div>

      {/* Desktop: Sidebar - Agent List */}
      <div className="hidden md:block w-48 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-2">
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => onSelectAgent('claude')}
          />
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
