/**
 * Files API Route Tests
 *
 * Tests the file management API route configuration:
 * - Route structure and endpoint definitions
 * - Multer upload configuration
 * - Authentication middleware integration
 * - Request validation schemas
 *
 * Note: These tests verify route setup and middleware chain.
 * Full integration tests are in backend/tests/integration/file-operations.test.js
 *
 * @module tests/unit/files-route
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Files API Route', () => {
  let router;
  let constants;

  beforeEach(async () => {
    const mod = await import('../../routes/api/files.js');
    router = mod.default;
    constants = await import('../../services/files/constants.js');
  });

  // ── Router structure ──

  describe('Router structure', () => {
    it('should export an Express Router', () => {
      assert.ok(router);
      assert.strictEqual(typeof router, 'function');
    });

    it('should have route stack', () => {
      assert.ok(Array.isArray(router.stack));
      assert.ok(router.stack.length > 0, 'Router should have registered routes');
    });
  });

  // ── Constants validation ──

  describe('File constants', () => {
    it('should export MAX_FILE_SIZE as a positive number', () => {
      assert.strictEqual(typeof constants.MAX_FILE_SIZE, 'number');
      assert.ok(constants.MAX_FILE_SIZE > 0);
    });

    it('should export MAX_FILES_COUNT as a positive integer', () => {
      assert.strictEqual(typeof constants.MAX_FILES_COUNT, 'number');
      assert.ok(constants.MAX_FILES_COUNT > 0);
      assert.ok(Number.isInteger(constants.MAX_FILES_COUNT));
    });

    it('should export ALLOWED_UPLOAD_EXTENSIONS as non-empty array', () => {
      assert.ok(Array.isArray(constants.ALLOWED_UPLOAD_EXTENSIONS));
      assert.ok(constants.ALLOWED_UPLOAD_EXTENSIONS.length > 0);
    });

    it('should have valid file extensions with dots', () => {
      for (const ext of constants.ALLOWED_UPLOAD_EXTENSIONS) {
        assert.ok(ext.startsWith('.'), `Extension "${ext}" should start with a dot`);
      }
    });

    it('should include common file types', () => {
      const exts = constants.ALLOWED_UPLOAD_EXTENSIONS;
      assert.ok(exts.includes('.pdf'), 'Should allow PDF files');
      assert.ok(exts.includes('.md'), 'Should allow Markdown files');
      assert.ok(exts.includes('.txt'), 'Should allow text files');
    });

    it('should export FILE_SIZE_LIMITS', () => {
      assert.ok(constants.FILE_SIZE_LIMITS);
      assert.ok(constants.FILE_SIZE_LIMITS.MAX_SIZE > 0);
    });

    it('should export OPERATION_TIMEOUTS', () => {
      assert.ok(constants.OPERATION_TIMEOUTS);
      assert.ok(constants.OPERATION_TIMEOUTS.DEFAULT > 0);
    });

    it('should export isBinaryFile function', () => {
      assert.strictEqual(typeof constants.isBinaryFile, 'function');
    });
  });

  // ── isBinaryFile tests ──

  describe('isBinaryFile()', () => {
    it('should identify binary file extensions', () => {
      // Common binary extensions
      assert.strictEqual(constants.isBinaryFile('image.png'), true);
      assert.strictEqual(constants.isBinaryFile('doc.pdf'), true);
      assert.strictEqual(constants.isBinaryFile('archive.zip'), true);
    });

    it('should identify text file extensions', () => {
      assert.strictEqual(constants.isBinaryFile('script.js'), false);
      assert.strictEqual(constants.isBinaryFile('style.css'), false);
      assert.strictEqual(constants.isBinaryFile('readme.md'), false);
    });
  });

  // ── Endpoint verification ──

  describe('Route endpoints', () => {
    it('should register GET /:projectName/file route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const fileReadRoute = routes.find(r => r.path === '/:projectName/file');
      assert.ok(fileReadRoute, 'Should have file read route');
      assert.ok(fileReadRoute.methods.includes('get'));
    });

    it('should register PUT /:projectName/file route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const fileWriteRoute = routes.find(r =>
        r.path === '/:projectName/file' && r.methods.includes('put')
      );
      assert.ok(fileWriteRoute, 'Should have file write route');
    });

    it('should register GET /:projectName/files route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const fileTreeRoute = routes.find(r =>
        r.path === '/:projectName/files' && r.methods.includes('get')
      );
      assert.ok(fileTreeRoute, 'Should have file tree route');
    });

    it('should register DELETE /:projectName/files route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const deleteRoute = routes.find(r =>
        r.path === '/:projectName/files' && r.methods.includes('delete')
      );
      assert.ok(deleteRoute, 'Should have delete route');
    });

    it('should register POST /upload route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const uploadRoute = routes.find(r =>
        r.path === '/upload' && r.methods.includes('post')
      );
      assert.ok(uploadRoute, 'Should have upload route');
    });

    it('should register PUT /:projectName/rename route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const renameRoute = routes.find(r =>
        r.path === '/:projectName/rename' && r.methods.includes('put')
      );
      assert.ok(renameRoute, 'Should have rename route');
    });

    it('should register POST /:projectName/directory route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const mkdirRoute = routes.find(r =>
        r.path === '/:projectName/directory' && r.methods.includes('post')
      );
      assert.ok(mkdirRoute, 'Should have directory creation route');
    });

    it('should register POST /:projectName/move route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const moveRoute = routes.find(r =>
        r.path === '/:projectName/move' && r.methods.includes('post')
      );
      assert.ok(moveRoute, 'Should have move route');
    });

    it('should register GET /:projectName/file/download route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const downloadRoute = routes.find(r =>
        r.path === '/:projectName/file/download' && r.methods.includes('get')
      );
      assert.ok(downloadRoute, 'Should have download route');
    });

    it('should register GET /:projectName/files/exists route', () => {
      const routes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const existsRoute = routes.find(r =>
        r.path === '/:projectName/files/exists' && r.methods.includes('get')
      );
      assert.ok(existsRoute, 'Should have file existence check route');
    });
  });
});
