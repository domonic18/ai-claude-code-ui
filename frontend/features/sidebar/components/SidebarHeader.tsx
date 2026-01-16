/**
 * SidebarHeader Component
 *
 * Header section of the sidebar containing logo, title, and action buttons.
 * Handles responsive layout for mobile and desktop views.
 *
 * Features:
 * - Desktop and mobile responsive layouts
 * - Refresh button with loading state
 * - New project button
 * - Optional toggle sidebar button
 * - Platform-aware logo/link
 */

import React, { memo } from 'react';
import { MessageSquare, RefreshCw, FolderPlus, ChevronLeft } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SidebarHeaderProps } from '../types/sidebar.types';
import { IS_PLATFORM, PLATFORM_DASHBOARD_URL } from '../constants/sidebar.constants';

/**
 * SidebarHeader Component
 */
export const SidebarHeader = memo(function SidebarHeader({
  isRefreshing,
  onRefresh,
  onShowNewProject,
  isPWA = false,
  isMobile = false,
  onToggleSidebar,
}: SidebarHeaderProps) {
  const handleRefresh = async () => {
    await onRefresh();
  };

  // Desktop Header
  const desktopHeader = (
    <div className="hidden md:flex items-center justify-between">
      {IS_PLATFORM ? (
        <a
          href={PLATFORM_DASHBOARD_URL}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
          title="View Environments"
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Claude Code UI</h1>
            <p className="text-sm text-muted-foreground">AI coding assistant interface</p>
          </div>
        </a>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Claude Code UI</h1>
            <p className="text-sm text-muted-foreground">AI coding assistant interface</p>
          </div>
        </div>
      )}
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0 hover:bg-accent transition-colors duration-200"
          onClick={onToggleSidebar}
          title="Hide sidebar"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
      )}
    </div>
  );

  // Mobile Header
  const mobileHeader = (
    <div
      className="md:hidden p-3 border-b border-border"
      style={isPWA && isMobile ? { paddingTop: '16px' } : {}}
    >
      <div className="flex items-center justify-between">
        {IS_PLATFORM ? (
          <a
            href={PLATFORM_DASHBOARD_URL}
            className="flex items-center gap-3 active:opacity-70 transition-opacity"
            title="View Environments"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Claude Code UI</h1>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Claude Code UI</h1>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center active:scale-95 transition-all duration-150"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh projects"
          >
            <RefreshCw className={`w-4 h-4 text-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-all duration-150"
            onClick={onShowNewProject}
            title="New project"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // Desktop Action Bar (New Project + Refresh buttons)
  const desktopActionBar = (
    <div className="hidden md:block px-4 py-2 border-b border-border">
      <div className="flex gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow rounded-md px-3 flex-1 h-8 text-xs bg-primary hover:bg-primary/90 transition-all duration-200"
          onClick={onShowNewProject}
          title="Create new project"
        >
          <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
          New Project
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:text-accent-foreground rounded-md text-xs h-8 w-8 px-0 hover:bg-accent transition-colors duration-200 group"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh projects and sessions (Ctrl+R)"
        >
          <RefreshCw className={`w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:p-4 md:border-b md:border-border">
        {desktopHeader}
        {mobileHeader}
      </div>
      {desktopActionBar}
    </>
  );
});

export default SidebarHeader;
