/**
 * 容器服务索引
 *
 * 导出所有容器相关服务以便于导入。
 */

// 容器管理器类 - 直接导入
export { ContainerManager } from './ContainerManager.js';

// 用于向后兼容的默认导出
import { ContainerManager as _CM } from './ContainerManager.js';
const _instance = new _CM();
export default _instance;

// 从 ClaudeSDKContainer 重新导出常用函数
export {
  queryClaudeSDKInContainer,
  abortClaudeSDKSessionInContainer,
  isClaudeSDKSessionActiveInContainer,
  getActiveClaudeSDKSessionsInContainer,
  getContainerSessionInfo
} from './ClaudeSDKContainer.js';

// 从 PtyContainer 重新导出常用函数
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

// 从 FileContainer 重新导出文件操作函数
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
