/**
 * Claude SDK 容器集成（兼容层）
 * 
 * 此文件作为向后兼容层，重新导出新的模块化实现。
 * 所有核心功能已迁移到 ./claude/ 目录下的独立模块中。
 * 
 * 模块结构：
 * - claude/ClaudeQuery.js - 查询编排
 * - claude/DockerExecutor.js - Docker 执行引擎
 * - claude/ScriptBuilder.js - 脚本生成器
 * - claude/MessageTransformer.js - 消息转换器
 * - claude/SessionManager.js - 会话管理
 */

// 导出所有功能
export {
  queryClaudeSDKInContainer,
  abortClaudeSDKSessionInContainer,
  isClaudeSDKSessionActiveInContainer,
  getActiveClaudeSDKSessionsInContainer,
  getContainerSessionInfo,
  // 向后兼容的别名
  abortClaudeSDKSession,
  isClaudeSDKSessionActive,
  getActiveClaudeSDKSessions
} from './claude/index.js';
