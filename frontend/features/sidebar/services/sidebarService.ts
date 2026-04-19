/**
 * Sidebar Service
 *
 * Service layer for all Sidebar-related API calls.
 * Provides centralized API management with error handling and type safety.
 */

import { api } from '@/shared/services';
import type { Project, Session, SessionMeta, SessionProvider, PaginatedSessionsResponse } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

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
 * Options for executing API requests
 */
interface RequestOptions {
  /** Error message prefix (e.g., "Failed to fetch projects") */
  errorPrefix: string;
  /** API endpoint URL for error reporting */
  endpoint: string;
  /** Whether to attempt parsing error response as JSON */
  parseErrorResponse?: boolean;
  /** Whether to attempt parsing error response as text */
  parseErrorText?: boolean;
  /** Optional response parser for successful responses */
  responseParser?: (response: Response) => any;
}

/**
 * Sidebar Service Class
 *
 * Handles all API calls for the Sidebar feature.
 */
export class SidebarService {
  /**
   * Parse error message from failed response
   * @private
   */
  private async _parseErrorMessage(
    response: Response,
    options: RequestOptions
  ): Promise<string> {
    const fallback = `${options.errorPrefix}: ${response.statusText}`;

    if (!options.parseErrorResponse && !options.parseErrorText) {
      return fallback;
    }

    try {
      if (options.parseErrorResponse) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          return error.error || fallback;
        }
      } else if (options.parseErrorText) {
        const errorText = await response.text();
        if (errorText) return errorText;
      }
    } catch {
      // Ignore parse errors
    }

    return fallback;
  }

  /**
   * Private helper method to execute API requests with consistent error handling
   *
   * @param apiCall - Function that returns the Promise<Response>
   * @param options - Request options
   * @returns Promise<T> - Parsed response data
   * @throws {SidebarServiceError} If the request fails
   * @private
   */
  private async _executeRequest<T>(
    apiCall: () => Promise<Response>,
    options: RequestOptions
  ): Promise<T> {
    try {
      const response = await apiCall();

      if (!response.ok) {
        const errorMessage = await this._parseErrorMessage(response, options);
        throw new SidebarServiceError(errorMessage, response.status, options.endpoint);
      }

      // Parse successful response if parser provided
      if (options.responseParser) {
        return options.responseParser(response);
      }

      return undefined as T;
    } catch (error) {
      if (error instanceof SidebarServiceError) {
        throw error;
      }
      throw new SidebarServiceError(
        `${options.errorPrefix}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        options.endpoint
      );
    }
  }

  /**
   * Get all projects
   *
   * @returns Promise<Project[]> - Array of projects
   * @throws {SidebarServiceError} If the request fails
   */
  async getProjects(): Promise<Project[]> {
    return this._executeRequest<Project[]>(
      () => api.projects.list(),
      {
        errorPrefix: 'Failed to fetch projects',
        endpoint: '/api/projects',
        responseParser: async (response) => {
          const data = await response.json();
          return data.projects || data || [];
        }
      }
    );
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
    logger.info('[SidebarService] Fetching sessions:', { projectName, limit, offset });

    const result = await this._executeRequest<any>(
      () => api.projects.sessions(projectName, limit, offset),
      {
        errorPrefix: 'Failed to fetch sessions',
        endpoint: `/api/projects/${projectName}/sessions`,
        responseParser: async (response) => {
          const json = await response.json();
          logger.info('[SidebarService] Received response:', json);
          return json;
        }
      }
    );

    // Handle different response formats
    // API returns: {success: true, data: [...], meta: {pagination: {...}}}
    const sessions = Array.isArray(result.data) ? result.data : result.sessions || [];
    const hasMore = result.meta?.pagination?.hasMore !== undefined
      ? result.meta.pagination.hasMore
      : result.hasMore !== undefined
      ? result.hasMore
      : undefined;

    logger.info('[SidebarService] Parsed result:', { sessions, hasMore, sessionCount: sessions.length });

    return {
      sessions,
      hasMore,
    };
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
    await this._executeRequest<void>(
      () => api.renameProject(projectName, newName),
      {
        errorPrefix: 'Failed to rename project',
        endpoint: undefined,
        parseErrorResponse: true
      }
    );
  }

  /**
   * Delete a project
   *
   * @param projectName - Name of the project to delete
   * @returns Promise<void>
   * @throws {SidebarServiceError} If the request fails
   */
  async deleteProject(projectName: string): Promise<void> {
    await this._executeRequest<void>(
      () => api.deleteProject(projectName),
      {
        errorPrefix: 'Failed to delete project',
        endpoint: undefined,
        parseErrorResponse: true
      }
    );
  }

  /**
   * Create a new project
   *
   * @param path - File system path for the new project
   * @returns Promise<Project> - Created project
   * @throws {SidebarServiceError} If the request fails
   */
  async createProject(path: string): Promise<Project> {
    return this._executeRequest<Project>(
      () => api.createProject(path.trim()),
      {
        errorPrefix: 'Failed to create project',
        endpoint: undefined,
        parseErrorResponse: true,
        responseParser: async (response) => {
          const result = await response.json();
          return result.project || result;
        }
      }
    );
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
    await this._executeRequest<void>(
      () => api.renameSession(projectName, sessionId, newSummary),
      {
        errorPrefix: 'Failed to rename session',
        endpoint: undefined,
        parseErrorResponse: true
      }
    );
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
    await this._executeRequest<void>(
      async () => {
        if (provider === 'codex') {
          return await api.deleteCodexSession(sessionId);
        } else {
          return await api.deleteSession(projectName, sessionId);
        }
      },
      {
        errorPrefix: 'Failed to delete session',
        endpoint: undefined,
        parseErrorText: true
      }
    );
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
