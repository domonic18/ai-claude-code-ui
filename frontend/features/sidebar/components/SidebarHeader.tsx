/**
 * SidebarHeader Component
 *
 * Header section of the sidebar containing logo, title, and action buttons.
 * Handles responsive layout for mobile and desktop views.
 *
 * Features:
 * - Desktop and mobile responsive layouts
 * - Refresh button with loading state
 * - New session button (for teachers/students)
 * - Optional toggle sidebar button
 * - Platform-aware logo/link
 */

import React, { memo } from 'react';
import type { SidebarHeaderProps } from '../types/sidebar.types';
import { DesktopHeader, MobileHeader } from './SidebarHeaderParts';

/**
 * SidebarHeader Component
 */
export const SidebarHeader = memo(function SidebarHeader({
  isRefreshing,
  onRefresh,
  onNewSession,
  isPWA = false,
  isMobile = false,
  onToggleSidebar,
}: SidebarHeaderProps) {
  return (
    <div className="md:p-4 md:border-b md:border-border">
      <DesktopHeader
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        onToggleSidebar={onToggleSidebar}
      />
      <MobileHeader
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        onNewSession={onNewSession}
        isPWA={isPWA}
        isMobile={isMobile}
      />
    </div>
  );
});

export default SidebarHeader;
