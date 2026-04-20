/**
 * Project Activity Utilities
 *
 * 提供项目活动时间计算功能
 *
 * @module features/sidebar/utils/projectActivityUtils
 */

import type { Project } from '../types/sidebar.types';
import { getAllSessions } from './timeFormatters';

/**
 * Get the most recent activity date for a project
 *
 * @param project - The project to check
 * @returns The most recent activity date, or undefined if no activity
 */
export function getProjectLastActivity(project: Project): Date | undefined {
  const allSessions = getAllSessions(project);

  if (allSessions.length === 0) {
    return project.lastActivity ? new Date(project.lastActivity) : undefined;
  }

  const mostRecentSession = allSessions.reduce((latest, session) => {
    const sessionDate = new Date(session.lastActivity);
    const latestDate = new Date(latest.lastActivity);
    return sessionDate > latestDate ? session : latest;
  });

  const mostRecentDate = new Date(mostRecentSession.lastActivity);
  const projectActivity = project.lastActivity ? new Date(project.lastActivity) : new Date(0);

  return mostRecentDate > projectActivity ? mostRecentDate : projectActivity;
}
