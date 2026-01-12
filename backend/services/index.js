/**
 * 服务索引
 *
 * 所有服务的中央导出点。
 * 从单个位置提供便捷的导入。
 */

// ============================================================================
// 核心抽象层（新增）
// ============================================================================

// 核心接口
export {
  IExecutionEngine,
  IFileOperations,
  ISessionManager,
  IProjectDiscovery,
} from './core/interfaces/index.js';

// 核心类型
export {
  SESSION_CONSTANTS,
  SessionStatus,
  SessionSortField,
} from './core/types/session-types.js';

export {
  EXECUTION_CONSTANTS,
  ExecutionErrorCode,
  ExecutionState,
  createExecutionError,
  isExecutionError,
} from './core/types/execution-types.js';

export {
  MESSAGE_CONSTANTS,
  MessageType,
  MessageRole,
  MessageStatus,
  isSystemMessage,
  isApiErrorMessage,
  extractMessageText,
  calculateMessageTokens,
  filterSystemMessages,
  filterApiErrorMessages,
} from './core/types/message-types.js';

// 核心工具
export {
  JsonlParser,
  SessionGrouping,
  TokenUsageCalculator,
} from './core/utils/jsonl-parser.js';

export {
  PathUtils,
  PathValidator,
} from './core/utils/path-utils.js';

export {
  MessageFilter,
  MessageTransformer,
  MessageAggregator,
} from './core/utils/message-filter.js';

// ============================================================================
// 执行层（新增）
// ============================================================================

export * from './execution/index.js';

// ============================================================================
// 现有服务导出
// ============================================================================

// 容器服务
export * from './container/index.js';

// Claude 服务
export * from './claude/index.js';

// Cursor 服务
export * from './cursor/index.js';

// OpenAI 服务
export * from './openai/index.js';

// 项目服务
export * from './project/index.js';
