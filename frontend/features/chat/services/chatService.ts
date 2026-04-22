/**
 * Chat Service
 *
 * Service layer for chat-related API operations including:
 * - Sending messages
 * - Loading chat history
 * - Session management
 * - File operations
 */

// 导入认证请求工具，用于发送携带 JWT Token 的 API 请求
import { authenticatedFetch } from '@/shared/services';
// 导入日志工具，用于记录操作日志和错误信息
import { logger } from '@/shared/utils/logger';

/**
 * Chat service configuration
 */
interface ChatServiceConfig {
  /** 项目名称，用于关联项目和聊天记录 */
  projectName?: string;
  /** 会话 ID，用于标识聊天会话 */
  sessionId?: string;
}

/**
 * Send message request
 */
interface SendMessageRequest {
  /** 消息内容 */
  content: string;
  /** 附件列表 */
  files?: Array<File>;
  /** 会话 ID */
  sessionId?: string;
  /** AI 提供商（claude, cursor, codex） */
  provider?: string;
  /** 模型名称 */
  model?: string;
}

/**
 * Load messages response
 */
interface LoadMessagesResponse {
  /** 请求是否成功 */
  success: boolean;
  /** 消息列表 */
  messages?: Array<any>;
  /** 错误信息 */
  error?: string;
  /** 总消息数 */
  total?: number;
  /** 当前偏移量 */
  offset?: number;
  /** 是否还有更多消息 */
  hasMore?: boolean;
}

/**
 * Chat Service class
 *
 * 聊天服务类，封装所有聊天相关的 API 操作
 * 包括消息加载、文件上传、文件信息获取、命令执行等
 */
export class ChatService {
  // 私有配置对象，存储项目名称和会话 ID
  private config: ChatServiceConfig;

  /**
   * 构造函数
   *
   * @param config - 服务配置对象（项目名称、会话 ID）
   */
  constructor(config: ChatServiceConfig = {}) {
    this.config = config;
  }

  /**
   * 更新服务配置
   *
   * 合并新配置到现有配置，支持动态更新项目名称和会话 ID
   *
   * @param config - 部分配置对象
   */
  setConfig(config: Partial<ChatServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 加载会话聊天消息
   *
   * 从服务器获取指定会话的消息历史，支持分页加载
   *
   * @param options - 加载选项
   * @param options.sessionId - 会话 ID
   * @param options.offset - 消息偏移量（默认 0）
   * @param options.limit - 每页消息数量（默认 20）
   * @returns 消息加载结果，包含消息列表和分页信息
   */
  async loadMessages(options: {
    sessionId: string;
    offset?: number;
    limit?: number;
  }): Promise<LoadMessagesResponse> {
    try {
      const { sessionId, offset = 0, limit = 20 } = options;

      // 发送 POST 请求到消息加载接口
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
      logger.error('Error loading messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 上传文件附件
   *
   * 将文件上传到服务器，支持关联到指定会话和项目
   *
   * @param file - 要上传的文件对象
   * @param options - 上传选项（可选）
   * @param options.sessionId - 会话 ID（可选）
   * @param options.projectName - 项目名称（可选，优先使用配置中的项目名）
   * @returns 上传结果，包含文件 URL 和名称
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
      // 构建 FormData 对象，用于文件上传
      const formData = new FormData();
      formData.append('file', file);

      // 添加会话 ID（如果有）
      if (options?.sessionId) {
        formData.append('sessionId', options.sessionId);
      }

      // 添加项目名称（优先使用选项中的，其次使用配置中的）
      if (options?.projectName || this.config.projectName) {
        formData.append('project', options.projectName || this.config.projectName!);
      }

      // 发送文件上传请求
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
      logger.error('Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * 获取文件信息
   *
   * 从服务器获取指定文件的元数据（大小、修改时间、类型等）
   *
   * @param filePath - 文件路径
   * @param projectName - 项目名称（可选，默认使用配置中的项目名）
   * @returns 文件信息对象，包含文件元数据
   */
  async getFileInfo(filePath: string, projectName?: string): Promise<{
    success: boolean;
    info?: any;
    error?: string;
  }> {
    try {
      // 确定项目名称（优先使用参数中的，其次使用配置中的）
      const project = projectName || this.config.projectName;
      if (!project) {
        throw new Error('Project name required');
      }

      // 发送文件信息请求
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
      logger.error('Error getting file info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file info',
      };
    }
  }

  /**
   * 执行命令
   *
   * 向服务器发送命令执行请求（如文件操作、Git 操作等）
   *
   * @param command - 命令对象
   * @param command.name - 命令名称
   * @param command.args - 命令参数（可选）
   * @param command.context - 命令上下文（可选）
   * @returns 命令执行结果
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
      // 发送命令执行请求
      const response = await authenticatedFetch('/api/commands/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: command.name,
          args: command.args,
          // 合并上下文信息：项目路径、会话 ID 和自定义上下文
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
      logger.error('Error executing command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
      };
    }
  }
}

/**
 * 默认聊天服务实例（单例模式）
 */
let defaultChatService: ChatService | null = null;

/**
 * 获取或创建默认聊天服务
 *
 * 使用单例模式确保全局只有一个 ChatService 实例
 * 首次调用时创建实例，后续调用返回同一实例并更新配置
 *
 * @param config - 服务配置（可选）
 * @returns ChatService 单例实例
 */
export function getChatService(config?: ChatServiceConfig): ChatService {
  if (!defaultChatService) {
    // 首次调用：创建新实例
    defaultChatService = new ChatService(config);
  } else if (config) {
    // 后续调用：更新配置
    defaultChatService.setConfig(config);
  }
  return defaultChatService;
}
