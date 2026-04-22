// Cursor 品牌图标：根据当前主题切换亮色/暗色 SVG 资源
import React from 'react';
import { useTheme } from '@/shared/contexts/ThemeContext';

interface CursorLogoProps {
  className?: string;
  size?: number;
}

export const CursorLogo: React.FC<CursorLogoProps> = ({ className, size }) => {
  const { isDarkMode } = useTheme();
  const style = size ? { width: size, height: size } : undefined;

  return (
    <img
      src={isDarkMode ? "/icons/cursor-white.svg" : "/icons/cursor.svg"}
      alt="Cursor"
      className={className}
      style={style}
    />
  );
};

export default CursorLogo;
