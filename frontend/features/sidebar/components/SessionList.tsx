/**
 * SessionList Component
 *
 * Container for displaying a list of sessions within a project.
 *
 * Features:
 * - Loading skeleton while sessions are being fetched
 * - Empty state when no sessions exist
 * - Session items with click handlers
 * - Infinite scroll with Intersection Observer
 * - Auto-load more sessions when scrolling to bottom
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/lib/utils';
import SessionItem from './SessionItem';
import type { Session, SessionProvider } from '../types/sidebar.types';
import { getAllSessions, formatTimeAgo } from '../utils/timeFormatters';
import { SHOW_SCROLL_THRESHOLD, ACTIVE_SESSION_THRESHOLD } from '../constants/sidebar.constants';

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
 * SessionList Component with Infinite Scroll
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
  const { t } = useTranslation();
  const allSessions = getAllSessions({ sessions, cursorSessions, codexSessions });

  // Refs for Intersection Observer and loading state tracking
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isLoadingRef = useRef(false);
  /**
   * Ref to handleLoadMore to avoid closure issues in Intersection Observer callback
   */
  const handleLoadMoreRef = useRef<(() => Promise<void>) | null>(null);

  // Handle loading more sessions
  const handleLoadMore = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    await onLoadMoreSessions();
    isLoadingRef.current = false;
  }, [onLoadMoreSessions]);

  // Sync handleLoadMore to ref
  useEffect(() => {
    handleLoadMoreRef.current = handleLoadMore;
  }, [handleLoadMore]);

  // Setup Intersection Observer for infinite scroll
  useEffect(() => {
    // Only set up observer if there are more sessions to load
    if (!hasMoreSessions || !loadMoreTriggerRef.current) {
      return;
    }

    // Don't start loading if already loading
    if (isLoadingSessions) {
      return;
    }

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        // When the trigger element becomes visible, load more sessions
        if (entries[0].isIntersecting && !isLoadingRef.current) {
          handleLoadMoreRef.current?.();
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: '100px', // Start loading 100px before reaching the bottom
      }
    );

    observer.observe(loadMoreTriggerRef.current);
    observerRef.current = observer;

    // Cleanup on unmount or when conditions change
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [hasMoreSessions, isLoadingSessions, handleLoadMoreRef]);

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
        <p className="text-xs text-muted-foreground">{t('sidebar.noSessionsYet')}</p>
      </div>
    );
  }

  // Show scrollbar when there are enough sessions for better UX
  const shouldShowScroll = allSessions.length >= SHOW_SCROLL_THRESHOLD;

  return (
    <div className={cn('space-y-1', shouldShowScroll && 'max-h-[85vh] overflow-y-auto')}>
      {/* New Session Button - Mobile */}
      {onNewSession && (
        <div className="md:hidden px-3 pt-2 pb-1">
          <button
            onClick={onNewSession}
            className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center justify-center gap-2 font-medium text-xs active:scale-[0.98] transition-all duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
              <path d="M5 12h14"></path>
              <path d="M12 5v14"></path>
            </svg>
            {t('sidebar.newSession')}
          </button>
        </div>
      )}

      {/* New Session Button - Desktop */}
      {onNewSession && (
        <Button
          variant="default"
          size="sm"
          className="hidden md:flex w-full justify-start gap-2 mb-1 h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          onClick={onNewSession}
        >
          <Plus className="w-3 h-3" />
          {t('sidebar.newSession')}
        </Button>
      )}

      {allSessions.map((session) => {
        const isSelected = selectedSessionId === session.id;
        const isActive = currentTime.getTime() - new Date(session.lastActivity).getTime() < ACTIVE_SESSION_THRESHOLD;
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

      {hasMoreSessions && (
        <div className="flex justify-center py-3">
          {isLoadingSessions ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full border border-muted-foreground border-t-transparent" />
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            <div
              ref={loadMoreTriggerRef}
              style={{ height: '1px' }}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
});

export default SessionList;
