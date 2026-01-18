import React from 'react';

interface ClaudeLogoProps {
  className?: string;
  size?: number;
}

export const ClaudeLogo: React.FC<ClaudeLogoProps> = ({ className, size }) => {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <img src="/icons/claude-ai-icon.svg" alt="Claude" className={className} style={style} />
  );
};

export default ClaudeLogo;
