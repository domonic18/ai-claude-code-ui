/**
 * direct/index.js
 *
 * 直连 provider 统一导出（四件套对齐 codex/index.js 模式）。
 *
 * @module services/execution/direct
 */

export {
  queryDirect,
  abortDirectSession,
  isDirectSessionActive,
  getActiveDirectSessions,
} from './DirectQuery.js';
