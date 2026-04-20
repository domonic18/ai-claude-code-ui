/**
 * Git 提交操作模块
 *
 * 提供创建初始提交、提交文件、切换/创建分支等写操作。
 * 使用 spawn + 参数数组执行 git 命令，防止命令注入。
 *
 * @module services/scm/gitCommit
 */

// Re-export all functions from the split modules
export {
  createInitialCommit,
  commitFiles,
  checkoutBranch,
  createBranch,
  generateCommitMessage,
  cleanCommitMessage
} from './gitCommitOperations.js';

export {
  discardChanges,
  deleteUntracked
} from './gitDiscard.js';

