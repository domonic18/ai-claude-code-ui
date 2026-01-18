/**
 * Time Formatting Utilities
 *
 * Functions for formatting time-related data in the Sidebar.
 */

import { TIME_THRESHOLDS, ACTIVE_SESSION_THRESHOLD } from '../constants/sidebar.constants';
import type { Session } from '../types/sidebar.types';

/**
 * Format a date string as "time ago" (e.g., "5 mins ago", "2 hours ago")
 *
 * @param dateString - The date string to format
 * @param currentTime - The current time to compare against
 * @returns Formatted time ago string
 *
 * @example
 * formatTimeAgo('2024-01-16T10:00:00Z', new Date('2024-01-16T10:05:00Z'))
 * // Returns: "5 mins ago"
 */
export function formatTimeAgo(dateString: string, currentTime: Date): string {
  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }

  const diffInMs = currentTime.getTime() - date.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInSeconds < TIME_THRESHOLDS.JUST_NOW / 1000) return 'Just now';
  if (diffInMinutes === 1) return '1 min ago';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return date.toLocaleDateString();
}

/**
 * Get the last activity date from a session
 *
 * @param session - The session object
 * @returns The last activity date
 */
export function getSessionDate(session: Session): Date {
  if (session.__provider === 'cursor' && session.createdAt) {
    return new Date(session.createdAt);
  }
  if (session.__provider === 'codex' && (session.createdAt || session.lastActivity)) {
    return new Date(session.createdAt || session.lastActivity);
  }
  return new Date(session.lastActivity);
}

/**
 * Check if a session is active (within last 10 minutes)
 *
 * @param session - The session object
 * @param currentTime - The current time
 * @returns True if the session is active
 */
export function isSessionActive(session: Session, currentTime: Date): boolean {
  const sessionDate = getSessionDate(session);
  const diffInMs = currentTime.getTime() - sessionDate.getTime();
  return diffInMs < ACTIVE_SESSION_THRESHOLD;
}

/**
 * Format the last activity time for a project
 *
 * @param lastActivity - The last activity date string
 * @param currentTime - The current time
 * @returns Formatted time ago string
 */
export function formatLastActivity(lastActivity: string | undefined, currentTime: Date): string {
  if (!lastActivity) return 'Never';
  return formatTimeAgo(lastActivity, currentTime);
}

/**
 * Get all unique sessions from a project (including cursor and codex sessions)
 *
 * @param project - The project object
 * @returns Array of all sessions with provider info
 */
export function getAllSessions(project: {
  sessions?: Session[];
  cursorSessions?: Session[];
  codexSessions?: Session[];
}): Session[] {
  const claudeSessions = (project.sessions || []).map(s => ({ ...s, __provider: 'claude' as const }));
  const cursorSessions = (project.cursorSessions || []).map(s => ({ ...s, __provider: 'cursor' as const }));
  const codexSessions = (project.codexSessions || []).map(s => ({ ...s, __provider: 'codex' as const }));

  return [...claudeSessions, ...cursorSessions, ...codexSessions];
}
