/**
 * DesktopSidebar - Fixed sidebar for desktop view with toggle
 *
 * @module features/system/components/DesktopSidebar
 */

import { Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from '@/features/sidebar/components';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';

interface DesktopSidebarProps {
  sidebarVisible: boolean;
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

// 由父组件调用，React 组件或常量：DesktopSidebar
/**
 * Renders the fixed desktop sidebar with optional collapsed state
 */
export function DesktopSidebar({
  sidebarVisible,
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
  return (
    <div
      className={`h-full flex-shrink-0 border-r border-border bg-card transition-all duration-300 ${
        sidebarVisible ? 'w-80' : 'w-14'
      }`}
    >
      <div className="h-full overflow-hidden">
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
    </div>
  );
}

/** Collapsed sidebar with expand and settings buttons */
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
