/**
 * options-mapper.test.js
 *
 * 选项映射器单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapCliOptionsToSDK, validateSdkOptions } from '../claude/OptionsMapper.js';

describe('OptionsMapper', () => {
  describe('mapCliOptionsToSDK', () => {
    it('should map basic options correctly', () => {
      const cliOptions = {
        sessionId: 'test-session',
        cwd: '/workspace/test',
        model: 'sonnet'
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.equal(sdkOptions.resume, 'test-session');
      assert.equal(sdkOptions.cwd, '/workspace/test');
      // Note: ANTHROPIC_MODEL environment variable may override the model option
      assert.ok(sdkOptions.model);
    });

    it('should map permission mode correctly', () => {
      const cliOptions = {
        permissionMode: 'bypassPermissions'
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.equal(sdkOptions.permissionMode, 'bypassPermissions');
    });

    it('should handle skipPermissions correctly', () => {
      const cliOptions = {
        toolsSettings: {
          skipPermissions: true,
          allowedTools: []
        }
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.equal(sdkOptions.permissionMode, 'bypassPermissions');
    });

    it('should map allowed tools correctly', () => {
      const cliOptions = {
        toolsSettings: {
          allowedTools: ['Read', 'Write']
        }
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.deepEqual(sdkOptions.allowedTools, ['Read', 'Write']);
    });

    it('should add plan mode tools when permission mode is plan', () => {
      const cliOptions = {
        permissionMode: 'plan',
        toolsSettings: {
          allowedTools: ['Read']
        }
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.ok(sdkOptions.allowedTools.includes('Read'));
      assert.ok(sdkOptions.allowedTools.includes('Task'));
      assert.ok(sdkOptions.allowedTools.includes('exit_plan_mode'));
    });

    it('should map disallowed tools correctly', () => {
      const cliOptions = {
        toolsSettings: {
          disallowedTools: ['Bash', 'WebSearch']
        }
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      assert.deepEqual(sdkOptions.disallowedTools, ['Bash', 'WebSearch']);
    });

    it('should include system prompt configuration', () => {
      const sdkOptions = mapCliOptionsToSDK({});

      assert.equal(sdkOptions.systemPrompt.type, 'preset');
      assert.equal(sdkOptions.systemPrompt.preset, 'claude_code');
    });

    it('should include setting sources', () => {
      const sdkOptions = mapCliOptionsToSDK({});

      assert.deepEqual(sdkOptions.settingSources, ['project', 'user', 'local']);
    });

    it('should use default model when not specified', () => {
      const sdkOptions = mapCliOptionsToSDK({});

      assert.ok(sdkOptions.model);
      assert.equal(typeof sdkOptions.model, 'string');
    });

    it('should handle empty toolsSettings', () => {
      const cliOptions = {
        toolsSettings: {}
      };

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      // allowedTools should not be set when empty (to avoid unnecessary configuration)
      assert.equal(sdkOptions.allowedTools, undefined);
    });

    it('should handle missing toolsSettings', () => {
      const cliOptions = {};

      const sdkOptions = mapCliOptionsToSDK(cliOptions);

      // allowedTools should not be set when empty (to avoid unnecessary configuration)
      assert.equal(sdkOptions.allowedTools, undefined);
    });
  });

  describe('validateSdkOptions', () => {
    it('should pass validation with required fields', () => {
      const options = {
        model: 'sonnet'
      };

      const result = validateSdkOptions(options);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should fail validation without model', () => {
      const options = {};

      const result = validateSdkOptions(options);

      assert.equal(result.valid, false);
      assert.ok(result.errors.includes('model is required'));
    });

    it('should pass validation with all options', () => {
      const options = {
        model: 'sonnet',
        permissionMode: 'default',
        allowedTools: ['Read', 'Write'],
        cwd: '/workspace/test'
      };

      const result = validateSdkOptions(options);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });
  });
});
