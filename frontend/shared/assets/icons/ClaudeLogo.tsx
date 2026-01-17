import React from 'react';

interface ClaudeLogoProps {
  className?: string;
}

export const ClaudeLogo: React.FC<ClaudeLogoProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <img src="/icons/claude-ai-icon.svg" alt="Claude" className={className} />
  );
};

export default ClaudeLogo;
