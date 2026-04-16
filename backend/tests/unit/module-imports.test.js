/**
 * Module Imports Test
 *
 * Verifies that all service modules can be imported correctly.
 * This test runs quickly and helps catch import/export issues early.
 *
 * Note: Server index (backend/index.js) is NOT tested here because
 * importing it starts the HTTP server and Docker monitors, which
 * prevents the test process from exiting. That check belongs in
 * integration tests.
 */

import { describe, it } from 'node:test';

describe('Module Imports', () => {
  describe('Container Services', () => {
    it('should import Container Core module', () => import('../../services/container/core/index.js'));
    it('should import Container Claude module', () => import('../../services/container/claude/index.js'));
    it('should import PtyContainer exports', () => import('../../services/container/PtyContainer.js'));
    it('should import Files utils (container-path-utils)', () => import('../../services/files/utils/container-path-utils.js'));
    it('should import Files utils (container-ops)', () => import('../../services/files/utils/container-ops.js'));
    it('should import Files utils (file-tree)', () => import('../../services/files/utils/file-tree.js'));
    it('should import Files index', () => import('../../services/files/index.js'));
    it('should import Container index', () => import('../../services/container/index.js'));
  });

  describe('Execution Services', () => {
    it('should import ClaudeExecutor module', () => import('../../services/execution/claude/ClaudeExecutor.js'));
    it('should import Claude execution index', () => import('../../services/execution/claude/index.js'));
    it('should import CursorExecutor module', () => import('../../services/execution/cursor/CursorExecutor.js'));
    it('should import Cursor execution index', () => import('../../services/execution/cursor/index.js'));
    it('should import CodexExecutor module', () => import('../../services/execution/codex/CodexExecutor.js'));
    it('should import Codex execution index', () => import('../../services/execution/codex/index.js'));
    it('should import Execution engines', () => import('../../services/execution/engines/index.js'));
  });

  describe('Project Services', () => {
    it('should import Project index', () => import('../../services/projects/index.js'));
  });

  describe('Services Master Index', () => {
    it('should import Services index', () => import('../../services/index.js'));
  });

  describe('Database', () => {
    it('should import Database module', () => import('../../database/db.js'));
  });

  describe('Shared Constants', () => {
    it('should import Model constants', () => import('../../../shared/modelConstants.js'));
  });
});
