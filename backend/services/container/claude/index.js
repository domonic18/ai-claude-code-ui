/**
 * Claude 容器集成统一导出
 * 
 * 提供所有 Claude SDK 容器化功能的统一入口。
 */

// 主查询函数
export { queryClaudeSDKInContainer } from './ClaudeQuery.js';

// 会话管理
export {
  abortSession as abortClaudeSDKSessionInContainer,
  isSessionActive as isClaudeSDKSessionActiveInContainer,
  getActiveSessions as getActiveClaudeSDKSessionsInContainer,
  getSession as getContainerSessionInfo,
  setSessionStream
} from './SessionManager.js';


