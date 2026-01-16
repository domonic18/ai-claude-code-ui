import ClaudeLogo from '../ClaudeLogo';
import OpenCodeLogo from '../OpenCodeLogo';

const agentConfig = {
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

const colorClasses = {
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

export default function AgentListItem({ agentId, isSelected, onClick, isMobile = false }) {
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
}
