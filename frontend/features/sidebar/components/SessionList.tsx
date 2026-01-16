/**
 * SessionList Component
 *
 * Container for displaying a list of sessions within a project.
 *
 * Features:
 * - Loading skeleton while sessions are being fetched
 * - Empty state when no sessions exist
 * - Session items with click handlers
 * - Load more button for pagination
 */

import React, { memo, useCallback } from 'react';
import SessionItem from './SessionItem';
import type { Session, SessionProvider } from '../types/sidebar.types';
import { getAllSessions, formatTimeAgo } from '../utils/timeFormatters';

/**
 * SessionList Props
 */
interface SessionListProps {
  /** Project name for the session list */
  projectName: string;
  /** Sessions from project */
  sessions?: Session[];
  /** Cursor sessions */
  cursorSessions?: Session[];
  /** Codex sessions */
  codexSessions?: Session[];
  /** Currently selected session ID */
  selectedSessionId?: string;
  /** Current time for active status calculation */
  currentTime: Date;
  /** Whether sessions are loading */
  isLoadingSessions: boolean;
  /** Whether initial sessions are loaded */
  initialSessionsLoaded: boolean;
  /** Whether has more sessions to load */
  hasMoreSessions: boolean;
  /** Session click callback */
  onSessionClick: (session: Session) => void;
  /** Delete session callback */
  onSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  /** Update session summary callback */
  onSessionRename: (projectName: string, sessionId: string, summary: string) => Promise<void>;
  /** Load more sessions callback */
  onLoadMoreSessions: () => Promise<void>;
  /** Current editing session */
  editingSession: Session | null;
  /** Set editing session callback */
  onSetEditingSession: (session: Session | null) => void;
  /** Editing session name */
  editingSessionName: string;
  /** Set editing session name callback */
  onSetEditingSessionName: (name: string) => void;
  /** New session callback (optional) */
  onNewSession?: () => void;
}

/**
 * SessionList Component
 */
export const SessionList = memo(function SessionList({
  projectName,
  sessions,
  cursorSessions,
  codexSessions,
  selectedSessionId,
  currentTime,
  isLoadingSessions,
  initialSessionsLoaded,
  hasMoreSessions,
  onSessionClick,
  onSessionDelete,
  onSessionRename,
  onLoadMoreSessions,
  editingSession,
  onSetEditingSession,
  editingSessionName,
  onSetEditingSessionName,
  onNewSession,
}: SessionListProps) {
  const allSessions = getAllSessions({ sessions, cursorSessions, codexSessions });

  const handleLoadMore = useCallback(async () => {
    await onLoadMoreSessions();
  }, [onLoadMoreSessions]);

  // Loading skeleton
  if (!initialSessionsLoaded) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-2 rounded-md">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 bg-muted rounded-full animate-pulse mt-0.5" />
              <div className="flex-1 space-y-1">
                <div
                  className="h-3 bg-muted rounded animate-pulse"
                  style={{ width: `${60 + i * 15}%` }}
                />
                <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (allSessions.length === 0 && !isLoadingSessions) {
    return (
      <div className="py-2 px-3 text-left">
        <p className="text-xs text-muted-foreground">No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {allSessions.map((session) => {
        const isSelected = selectedSessionId === session.id;
        const isActive = currentTime.getTime() - new Date(session.lastActivity).getTime() < 10 * 60 * 1000;
        const isEditing = editingSession?.id === session.id;

        return (
          <SessionItem
            key={session.id}
            session={session}
            isSelected={isSelected}
            isActive={isActive}
            timeAgo={formatTimeAgo(session.lastActivity, currentTime)}
            onClick={() => onSessionClick(session)}
            onDelete={() => onSessionDelete(projectName, session.id, session.__provider)}
            onStartRename={() => {
              onSetEditingSession(session);
              onSetEditingSessionName(session.summary || '');
            }}
            isRenaming={isEditing}
            renameValue={isEditing ? editingSessionName : session.summary || ''}
            onRenameChange={onSetEditingSessionName}
            onRenameSave={() => onSessionRename(projectName, session.id, editingSessionName)}
            onRenameCancel={() => {
              onSetEditingSession(null);
              onSetEditingSessionName('');
            }}
          />
        );
      })}

      {/* Load More Button */}
      {hasMoreSessions && !isLoadingSessions && (
        <button
          onClick={handleLoadMore}
          className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          Load more sessions...
        </button>
      )}

      {/* Loading More Indicator */}
      {isLoadingSessions && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Loading...
        </div>
      )}

      {/* New Session Button - Mobile */}
      {onNewSession && (
        <div className="md:hidden px-3 pb-2">
          <button
            onClick={onNewSession}
            className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center justify-center gap-2 font-medium text-xs active:scale-[0.98] transition-all duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M5 12h14"></path>
              <path d="M12 5v14"></path>
            </svg>
            New Session
          </button>
        </div>
      )}

      {/* New Session Button - Desktop */}
      {onNewSession && (
        <button
          onClick={onNewSession}
          className="items-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md px-3 hidden md:flex w-full justify-start gap-2 mt-1 h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <path d="M5 12h14"></path>
            <path d="M12 5v14"></path>
          </svg>
          New Session
        </button>
      )}
    </div>
  );
});

export default SessionList;
