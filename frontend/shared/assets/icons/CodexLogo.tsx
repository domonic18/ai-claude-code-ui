import React from 'react';
import { useTheme } from '@/shared/contexts/ThemeContext';

interface CodexLogoProps {
  className?: string;
}

export const CodexLogo: React.FC<CodexLogoProps> = ({ className = 'w-5 h-5' }) => {
  const { isDarkMode } = useTheme();

  return (
    <img
      src={isDarkMode ? "/icons/codex-white.svg" : "/icons/codex.svg"}
      alt="Codex"
      className={className}
    />
  );
};

export default CodexLogo;
