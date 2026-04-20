/**
 * Project Fetch Helpers
 *
 * Helper functions for fetching projects with retry logic and Cursor sessions
 *
 * @module features/system/hooks/projectFetchHelpers
 */

import { api, authenticatedFetch } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import { parseProjectsResponse } from './useProjectUtils';
import type { Project } from '@/features/sidebar/types/sidebar.types';

/**
 * Fetch Cursor sessions for a project
 * @param {Project} project - Project object
 * @returns {Promise<void>}
 */
async function fetchCursorSessionsForProject(project: Project): Promise<void> {
  try {
    const url = `/api/cursor/sessions?projectPath=${encodeURIComponent(project.fullPath || (project as any).path || '')}`;
    const cursorResponse = await authenticatedFetch(url);
    if (cursorResponse.ok) {
      const cursorData = await cursorResponse.json();
      if (cursorData.success && cursorData.sessions) {
        (project as any).cursorSessions = cursorData.sessions;
      }
    }
  } catch (error) {
    logger.error(`Error fetching Cursor sessions for project ${project.name}:`, error);
  }
}

/**
 * Fetch projects from API with error handling
 * @returns {Promise<{ok: boolean, status?: number, statusText?: string, data?: any[]}>}
 */
async function fetchProjectsFromAPI(): Promise<{
  ok: boolean;
  status?: number;
  statusText?: string;
  data?: any[];
}> {
  try {
    const response = await api.projects.list();

    if (!response.ok) {
      logger.error('Failed to fetch projects:', response.status, response.statusText);
      return { ok: false, status: response.status, statusText: response.statusText };
    }

    const responseData = await response.json();
    const data = parseProjectsResponse(responseData);
    return { ok: true, data };
  } catch (error) {
    logger.error('Error fetching projects:', error);
    throw error;
  }
}

/**
 * Handle retry logic for project fetching
 * @param {boolean} shouldRetry - Whether retry conditions are met
 * @param {number} retryCount - Current retry count
 * @param {number} maxRetries - Maximum allowed retries
 * @param {number} delay - Retry delay in ms
 * @param {Function} fetchProjects - Fetch function to call for retry
 * @returns {boolean} Whether retry was scheduled
 */
function handleRetryLogic(
  shouldRetry: boolean,
  retryCount: number,
  maxRetries: number,
  delay: number,
  fetchProjects: () => void
): boolean {
  if (shouldRetry && retryCount < maxRetries) {
    setTimeout(() => {
      logger.info(`[useProjects] Retry ${retryCount + 1}/${maxRetries}...`);
      fetchProjects();
    }, delay);
    return true;
  }
  return false;
}

/**
 * Fetch projects with retry logic
 *
 * @param {Object} user - Current user
 * @param {number} retryCount - Current retry count
 * @param {Function} fetchProjects - Fetch function to call for retry
 * @returns {Promise<Project[] | undefined>} Projects array or undefined
 */
export async function fetchProjectsWithRetry(
  user: { id: string } | null,
  retryCount: number,
  fetchProjects: (isRetry: boolean, retryCount: number) => Promise<Project[] | undefined>
): Promise<Project[] | undefined> {
  const result = await fetchProjectsFromAPI();

  if (!result.ok) {
    const scheduledRetry = handleRetryLogic(
      true,
      retryCount,
      10,
      2000,
      () => fetchProjects(true, retryCount + 1)
    );
    return scheduledRetry ? undefined : undefined;
  }

  const data = result.data || [];

  // If no projects found and user is logged in, keep retrying
  if (data.length === 0 && user) {
    const scheduledRetry = handleRetryLogic(
      true,
      retryCount,
      6,
      2000,
      () => {
        logger.info('[useProjects] Retrying project fetch...');
        fetchProjects(true, retryCount + 1);
      }
    );

    if (retryCount < 6) {
      logger.info(`[useProjects] No projects found (retry ${retryCount + 1}/6), container may be initializing...`);
      return data;
    } else {
      logger.info('[useProjects] Max retries reached, giving up');
      return data;
    }
  }

  // Fetch Cursor sessions for each project
  await Promise.all(data.map(fetchCursorSessionsForProject));

  return data;
}
