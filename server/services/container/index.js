/**
 * Container Services Index
 *
 * Exports all container-related services for easy importing.
 */

// Container Manager class - import directly
export { ContainerManager } from './ContainerManager.js';

// Default export for backward compatibility
import { ContainerManager as _CM } from './ContainerManager.js';
const _instance = new _CM();
export default _instance;

// Re-export commonly used functions from ClaudeSDKContainer
export {
  queryClaudeSDKInContainer,
  abortClaudeSDKSessionInContainer,
  isClaudeSDKSessionActiveInContainer,
  getActiveClaudeSDKSessionsInContainer,
  getContainerSessionInfo
} from './ClaudeSDKContainer.js';

// Re-export commonly used functions from PtyContainer
export {
  createPtyInContainer,
  sendInputToPty,
  resizePty,
  endPtySession,
  getPtySessionInfo,
  getActivePtySessions,
  getPtySessionsByUserId,
  endAllPtySessionsForUser,
  getPtySessionBuffer,
  cleanupIdlePtySessions
} from './PtyContainer.js';

// Re-export file operation functions from FileContainer
export {
  validatePath,
  hostPathToContainerPath,
  readFileInContainer,
  writeFileInContainer,
  getFileTreeInContainer,
  getFileStatsInContainer,
  deleteFileInContainer,
  getProjectsInContainer
} from './FileContainer.js';
