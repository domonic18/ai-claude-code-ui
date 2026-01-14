/**
 * 容器服务索引
 *
 * 导出所有容器相关服务以便于导入。
 */

// 容器适配器（新增）
export * from './adapters/index.js';

// 容器管理器类 - 直接从核心模块导入
export { ContainerManager } from './core/index.js';

// 用于向后兼容的默认导出（单例实例）
import containerManager from './core/index.js';
export default containerManager;

// 从 claude 模块导出常用函数
export {
  queryClaudeSDKInContainer,
  abortClaudeSDKSessionInContainer,
  isClaudeSDKSessionActiveInContainer,
  getActiveClaudeSDKSessionsInContainer,
  getContainerSessionInfo
} from './claude/index.js';

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

// 从 files 模块导出文件操作函数（已迁移到 services/files/utils/）
export {
  validatePath,
  hostPathToContainerPath,
  readFileInContainer,
  writeFileInContainer,
  getFileTreeInContainer,
  getFileStatsInContainer,
  deleteFileInContainer,
  fileExistsInContainer,
  createDirectoryInContainer
} from '../files/utils/index.js';

// 从 projects/managers 模块导出项目管理函数（已迁移）
export {
  getProjectsInContainer
} from '../projects/managers/ContainerProjectManager.js';
