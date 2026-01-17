/**
 * Sidebar Service
 *
 * Service layer for all Sidebar-related API calls.
 * Provides centralized API management with error handling and type safety.
 */

import { api } from '@/shared/services';
import type { Project, Session, SessionMeta, SessionProvider, PaginatedSessionsResponse } from '../types/sidebar.types';

/**
 * Error class for Sidebar service errors
 */
export class SidebarServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'SidebarServiceError';
  }
}

/**
 * Sidebar Service Class
 *
 * Handles all API calls for the Sidebar feature.
 */
export class SidebarService {
  /**
   * Get all projects
   *
   * @returns Promise<Project[]> - Array of projects
   * @throws {SidebarServiceError} If the request fails
   */
  async getProjects(): Promise<Project[]> {
    try {
      const response = await api.projects();

      if (!response.ok) {
        throw new SidebarServiceError(
          `Failed to fetch projects: ${response.statusText}`,
          response.status,
          '/api/projects'
        );
      }

      const data = await response.json();
      return data.projects || data || [];
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        '/api/projects'
      );
    }
  }

  /**
   * Get sessions for a project with pagination
   *
   * @param projectName - The name of the project
   * @param limit - Maximum number of sessions to return
   * @param offset - Number of sessions to skip
   * @returns Promise<PaginatedSessionsResponse> - Paginated sessions response
   * @throws {SidebarServiceError} If the request fails
   */
  async getSessions(
    projectName: string,
    limit: number = 5,
    offset: number = 0
  ): Promise<PaginatedSessionsResponse> {
    try {
      const response = await api.sessions(projectName, limit, offset);

      if (!response.ok) {
        throw new SidebarServiceError(
          `Failed to fetch sessions: ${response.statusText}`,
          response.status,
          `/api/projects/${projectName}/sessions`
        );
      }

      const result = await response.json();
      return {
        sessions: result.sessions || [],
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to fetch sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        `/api/projects/${projectName}/sessions`
      );
    }
  }

  /**
   * Rename a project
   *
   * @param projectName - Current project name
   * @param newName - New display name for the project
   * @returns Promise<void>
   * @throws {SidebarServiceError} If the request fails
   */
  async renameProject(projectName: string, newName: string): Promise<void> {
    try {
      const response = await api.renameProject(projectName, newName);

      if (!response.ok) {
        let errorMessage = `Failed to rename project: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new SidebarServiceError(errorMessage, response.status);
      }
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to rename project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a project
   *
   * @param projectName - Name of the project to delete
   * @returns Promise<void>
   * @throws {SidebarServiceError} If the request fails
   */
  async deleteProject(projectName: string): Promise<void> {
    try {
      const response = await api.deleteProject(projectName);

      if (!response.ok) {
        let errorMessage = `Failed to delete project: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new SidebarServiceError(errorMessage, response.status);
      }
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new project
   *
   * @param path - File system path for the new project
   * @returns Promise<Project> - Created project
   * @throws {SidebarServiceError} If the request fails
   */
  async createProject(path: string): Promise<Project> {
    try {
      const response = await api.createProject(path.trim());

      if (!response.ok) {
        let errorMessage = `Failed to create project: ${response.statusText}`;
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }
        throw new SidebarServiceError(errorMessage, response.status);
      }

      const result = await response.json();
      return result.project || result;
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Rename a session
   *
   * @param projectName - Name of the project
   * @param sessionId - ID of the session
   * @param newSummary - New summary/name for the session
   * @returns Promise<void>
   * @throws {SidebarServiceError} If the request fails
   */
  async renameSession(
    projectName: string,
    sessionId: string,
    newSummary: string
  ): Promise<void> {
    try {
      const response = await api.renameSession(projectName, sessionId, newSummary);

      if (!response.ok) {
        let errorMessage = `Failed to rename session: ${response.statusText}`;
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }
        throw new SidebarServiceError(errorMessage, response.status);
      }
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to rename session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a session
   *
   * @param projectName - Name of the project
   * @param sessionId - ID of the session
   * @param provider - Session provider (claude, cursor, or codex)
   * @returns Promise<void>
   * @throws {SidebarServiceError} If the request fails
   */
  async deleteSession(
    projectName: string,
    sessionId: string,
    provider: SessionProvider = 'claude'
  ): Promise<void> {
    try {
      let response: Response;

      if (provider === 'codex') {
        response = await api.deleteCodexSession(sessionId);
      } else {
        response = await api.deleteSession(projectName, sessionId);
      }

      if (!response.ok) {
        let errorMessage = `Failed to delete session: ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Ignore text parse errors
        }
        throw new SidebarServiceError(errorMessage, response.status);
      }
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of the SidebarService
 */
let sidebarServiceInstance: SidebarService | null = null;

/**
 * Get the singleton SidebarService instance
 *
 * @returns The SidebarService instance
 */
export function getSidebarService(): SidebarService {
  if (!sidebarServiceInstance) {
    sidebarServiceInstance = new SidebarService();
  }
  return sidebarServiceInstance;
}

/**
 * Reset the SidebarService instance (mainly for testing)
 */
export function resetSidebarService(): void {
  sidebarServiceInstance = null;
}

export default SidebarService;
