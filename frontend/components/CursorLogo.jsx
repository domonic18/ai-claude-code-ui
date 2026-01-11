import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const CursorLogo = ({ className = 'w-5 h-5' }) => {
  const { isDarkMode } = useTheme();

  return (
    <img
      src={isDarkMode ? "/icons/cursor-white.svg" : "/icons/cursor.svg"}
      alt="Cursor"
      className={className}
    />
  );
};

export default CursorLogo;
