/**
 * DesktopSidebar - Resizable sidebar for desktop view with toggle
 *
 * @module features/system/components/DesktopSidebar
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from '@/features/sidebar/components';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 500;
const COLLAPSED_WIDTH = 56;

interface DesktopSidebarProps {
  sidebarVisible: boolean;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: SidebarSession | null;
  isLoading: boolean;
  isPWA: boolean;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: SidebarSession, projectName: string) => void;
  onNewSession: (projectName: string) => void;
  onSessionDelete: (projectName: string, sessionId: string) => void;
  onProjectDelete: (projectName: string) => void;
  onRefresh: () => void;
  onShowSettings: () => void;
  onToggleSidebar: (visible: boolean) => void;
}

export function DesktopSidebar({
  sidebarVisible,
  sidebarWidth,
  onSidebarWidthChange,
  projects,
  selectedProject,
  selectedSession,
  isLoading,
  isPWA,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  onRefresh,
  onShowSettings,
  onToggleSidebar,
}: DesktopSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + delta));
      onSidebarWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onSidebarWidthChange]);

  const currentWidth = sidebarVisible ? sidebarWidth : COLLAPSED_WIDTH;

  return (
    <div
      className="h-full flex-shrink-0 flex"
      style={{ width: `${currentWidth}px` }}
    >
      <div className="flex-1 min-w-0 border-r border-border bg-card overflow-hidden">
        {sidebarVisible ? (
          <Sidebar
            projects={projects}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            onProjectSelect={onProjectSelect}
            onSessionSelect={onSessionSelect}
            onNewSession={onNewSession}
            onSessionDelete={onSessionDelete}
            onProjectDelete={onProjectDelete}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onShowSettings={onShowSettings}
            isPWA={isPWA}
            isMobile={false}
            onToggleSidebar={() => onToggleSidebar(false)}
          />
        ) : (
          <CollapsedSidebarIcons
            onExpand={() => onToggleSidebar(true)}
            onShowSettings={onShowSettings}
          />
        )}
      </div>
      {sidebarVisible && (
        <div
          onMouseDown={handleMouseDown}
          className={`flex-shrink-0 cursor-col-resize transition-colors relative group ${
            isResizing
              ? 'w-1.5 bg-primary'
              : 'w-[3px] hover:w-1.5 bg-border hover:bg-primary'
          }`}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        </div>
      )}
    </div>
  );
}

function CollapsedSidebarIcons({
  onExpand,
  onShowSettings,
}: {
  onExpand: () => void;
  onShowSettings: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center py-4 gap-4">
      <button
        onClick={onExpand}
        className="p-2 hover:bg-accent rounded-md transition-colors duration-200 group"
        aria-label="Show sidebar"
        title="Show sidebar"
      >
        <svg
          className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onShowSettings}
        className="p-2 hover:bg-accent rounded-md transition-colors duration-200"
        aria-label="Settings"
        title="Settings"
      >
        <SettingsIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
    </div>
  );
}
