/**
 * Git 操作服务（门面）
 *
 * 封装所有 git 命令执行和输出解析：
 * - 仓库验证和状态查询
 * - Diff、文件内容获取
 * - 提交、分支、远程操作
 * - AI 提交消息生成
 *
 * 本文件作为统一入口，将具体实现委托给子模块：
 * - gitValidator — 仓库路径解析与验证
 * - gitStatus — 状态查询、diff、提交历史
 * - gitCommit — 提交、分支切换、AI 提交消息
 * - gitRemote — 远程仓库操作
 *
 * 不依赖 Express，所有方法返回纯数据或抛出 Error。
 *
 * @module services/scm/GitService
 */

// 从子模块重导出所有公共 API
export { resolveProjectPath, validateRepository } from './gitValidator.js';
export { getStatus, getFileDiff, getFileWithDiff, getCommits, getCommitDiff, getRemoteStatus, getBranches, stripDiffHeaders } from './gitStatus.js';
export { createInitialCommit, commitFiles, checkoutBranch, createBranch, discardChanges, deleteUntracked, generateCommitMessage, cleanCommitMessage } from './gitCommit.js';
export { fetchFromRemote, pullFromRemote, pushToRemote, publishBranch } from './gitRemote.js';
