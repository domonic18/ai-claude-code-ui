import React from 'react';

interface DirectLogoProps {
  className?: string;
}

/**
 * 直连模型 provider 图标（闪电符号，SVG 内联不依赖主题切换）
 */
export const DirectLogo: React.FC<DirectLogoProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Direct"
  >
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export default DirectLogo;
