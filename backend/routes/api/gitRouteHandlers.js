/**
 * Git Route Handlers
 *
 * Business logic handlers for Git API routes.
 * Each handler validates parameters and calls GitService operations.
 * Handlers are organized into sub-modules by functionality.
 *
 * @module routes/api/gitRouteHandlers
 */

// Re-export all handlers from sub-modules
export {
  handleGetStatus,
  handleGetDiff,
  handleGetFileWithDiff,
  handleGetBranches,
  handleGetCommits,
  handleGetCommitDiff,
  handleGetRemoteStatus
} from './gitReadHandlers.js';

export {
  handleInitialCommit,
  handleCommit,
  handleGenerateCommitMessage,
  handleCheckout,
  handleCreateBranch,
  handleDiscard,
  handleDeleteUntracked
} from './gitWriteHandlers.js';

export {
  handleFetch,
  handlePull,
  handlePush,
  handlePublish
} from './gitRemoteHandlers.js';

