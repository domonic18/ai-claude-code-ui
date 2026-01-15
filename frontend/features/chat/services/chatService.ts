/**
 * Chat Service
 *
 * Service layer for chat-related API operations including:
 * - Sending messages
 * - Loading chat history
 * - Session management
 * - File operations
 */

import { authenticatedFetch } from '../../../utils/api';

/**
 * Chat service configuration
 */
interface ChatServiceConfig {
  /** Project name */
  projectName?: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Send message request
 */
interface SendMessageRequest {
  /** Message content */
  content: string;
  /** Attached files */
  files?: Array<File>;
  /** Session ID */
  sessionId?: string;
  /** Provider (claude, cursor, codex) */
  provider?: string;
  /** Model to use */
  model?: string;
}

/**
 * Load messages response
 */
interface LoadMessagesResponse {
  success: boolean;
  messages?: Array<any>;
  error?: string;
  total?: number;
  offset?: number;
  hasMore?: boolean;
}

/**
 * Chat Service class
 */
export class ChatService {
  private config: ChatServiceConfig;

  constructor(config: ChatServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Update service configuration
   */
  setConfig(config: Partial<ChatServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Load chat messages for a session
   */
  async loadMessages(options: {
    sessionId: string;
    offset?: number;
    limit?: number;
  }): Promise<LoadMessagesResponse> {
    try {
      const { sessionId, offset = 0, limit = 20 } = options;

      const response = await authenticatedFetch('/api/sessions/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          offset,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error loading messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload a file attachment
   */
  async uploadFile(file: File, options?: {
    sessionId?: string;
    projectName?: string;
  }): Promise<{
    success: boolean;
    url?: string;
    name?: string;
    error?: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (options?.sessionId) {
        formData.append('sessionId', options.sessionId);
      }

      if (options?.projectName || this.config.projectName) {
        formData.append('project', options.projectName || this.config.projectName!);
      }

      const response = await authenticatedFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string, projectName?: string): Promise<{
    success: boolean;
    info?: any;
    error?: string;
  }> {
    try {
      const project = projectName || this.config.projectName;
      if (!project) {
        throw new Error('Project name required');
      }

      const response = await authenticatedFetch('/api/files/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: project,
          filePath,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get file info');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting file info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file info',
      };
    }
  }

  /**
   * Execute command
   */
  async executeCommand(command: {
    name: string;
    args?: string[];
    context?: any;
  }): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const response = await authenticatedFetch('/api/commands/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: command.name,
          args: command.args,
          context: {
            projectPath: this.config.projectName,
            sessionId: this.config.sessionId,
            ...command.context,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute command');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error executing command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
      };
    }
  }
}

/**
 * Default chat service instance
 */
let defaultChatService: ChatService | null = null;

/**
 * Get or create the default chat service
 */
export function getChatService(config?: ChatServiceConfig): ChatService {
  if (!defaultChatService) {
    defaultChatService = new ChatService(config);
  } else if (config) {
    defaultChatService.setConfig(config);
  }
  return defaultChatService;
}
