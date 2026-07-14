/**
 * TanStack Query Hooks
 *
 * 基于 TanStack Query 的自定义 Hooks。
 */

// Projects
export { useProjectsQuery, useInvalidateProjects } from './useProjectsQuery';
export type { UseProjectsQueryOptions } from './useProjectsQuery';

// Sessions
export {
  useSessionsQuery,
  useRenameSessionMutation,
  useDeleteSessionMutation,
  useInvalidateSessions,
} from './useSessionsQuery';
export type {
  UseSessionsQueryOptions,
  RenameSessionMutationParams,
  DeleteSessionMutationParams,
} from './useSessionsQuery';

// Documents
export {
  useDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  useUpdateSummaryMutation,
  useRegenerateSummaryMutation,
  useInvalidateDocuments,
} from './useDocumentsQuery';
export type {
  UploadDocumentMutationParams,
  DeleteDocumentMutationParams,
  UpdateSummaryMutationParams,
  RegenerateSummaryMutationParams,
} from './useDocumentsQuery';

