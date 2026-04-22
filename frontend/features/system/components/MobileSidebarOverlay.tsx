/**
 * MobileSidebarOverlay - Slide-in sidebar for mobile view
 *
 * @module features/system/components/MobileSidebarOverlay
 */

import { Sidebar } from '@/features/sidebar/components';
import type { Project, Session as SidebarSession } from '@/features/sidebar/types/sidebar.types';

interface MobileSidebarOverlayProps {
  sidebarOpen: boolean;
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
  onClose: () => void;
}

// 由父组件调用，React 组件或常量：MobileSidebarOverlay
/**
 * Renders a mobile-friendly overlay sidebar with backdrop
 */
export function MobileSidebarOverlay({
  sidebarOpen,
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
  onClose,
}: MobileSidebarOverlayProps) {
  return (
    <div className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${
      sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
    }`}>
      <button
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-150 ease-out"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
        aria-label="Close sidebar"
      />
      <div
        className={`relative w-[85vw] max-w-sm sm:w-80 h-full bg-card border-r border-border transform transition-transform duration-150 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
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
          isMobile={true}
          onToggleSidebar={() => {}}
        />
      </div>
    </div>
  );
}
