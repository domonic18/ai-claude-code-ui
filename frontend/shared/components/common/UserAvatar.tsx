/**
 * User Avatar Component
 *
 * Displays user avatar with first letter of name.
 */

import React from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';

export interface UserAvatarProps {
  onClick?: () => void;
  className?: string;
}

export function UserAvatar({ onClick, className = '' }: UserAvatarProps) {
  const { user } = useAuth();

  // Get first letter of name or email
  const initial = user?.name?.[0] || user?.email?.[0] || 'U';

  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold hover:bg-primary/90 transition-colors ${className}`}
      aria-label="User menu"
      title={user?.name || user?.email || 'User'}
    >
      {initial}
    </button>
  );
}
