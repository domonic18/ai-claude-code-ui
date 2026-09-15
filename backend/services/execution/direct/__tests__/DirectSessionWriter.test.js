/**
 * DirectSessionWriter.test.js
 *
 * 直连会话写入器纯函数测试（条目构造 / usage 归一化 / uuid 链）。
 * 容器 IO（readDirectSessionEntries/appendDirectTurn）依赖 Docker，留集成验收。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserEntry,
  buildAssistantEntry,
  normalizeUsage,
  getLastEntryUuid,
  isSessionFileNotFound,
  DIRECT_ENTRY_VERSION,
} from '../DirectSessionWriter.js';

describe('isSessionFileNotFound', () => {
  it('应识别文件不存在错误（readFileFromContainer 固定消息形态）', () => {
    assert.equal(isSessionFileNotFound(new Error('File not found: /workspace/x/s.jsonl')), true);
  });

  it('应放行其他读取异常（超时/流错误），驱动上抛而非按空会话覆盖', () => {
    assert.equal(isSessionFileNotFound(new Error('Docker exec timed out after 30000ms while reading: /x/s.jsonl')), false);
    assert.equal(isSessionFileNotFound(new Error('Failed to read file: socket hang up')), false);
  });

  it('应容忍空值与非 Error 入参', () => {
    assert.equal(isSessionFileNotFound(null), false);
    assert.equal(isSessionFileNotFound(undefined), false);
    assert.equal(isSessionFileNotFound({}), false);
    assert.equal(isSessionFileNotFound('File not found: x'), false);
  });
});

describe('buildUserEntry', () => {
  it('should satisfy grouping four-condition for first entry', () => {
    const entry = buildUserEntry({
      sessionId: 's-1', parentUuid: null, content: '你好', projectName: 'proj',
    });
    // sessionGrouping.js 首条判定：sessionId + type==='user' + parentUuid===null + uuid
    assert.equal(entry.sessionId, 's-1');
    assert.equal(entry.type, 'user');
    assert.equal(entry.parentUuid, null);
    assert.ok(entry.uuid, 'uuid 必须存在');
    assert.equal(entry.provider, 'direct');
    assert.equal(entry.message.role, 'user');
    assert.equal(entry.message.content, '你好');
    assert.equal(entry.cwd, '/workspace/proj');
    assert.ok(!Number.isNaN(Date.parse(entry.timestamp)), 'timestamp 必须是合法 ISO8601');
  });

  it('should keep given parentUuid for continuation entries', () => {
    const entry = buildUserEntry({
      sessionId: 's-1', parentUuid: 'prev-uuid', content: '续聊', projectName: 'proj',
    });
    assert.equal(entry.parentUuid, 'prev-uuid');
  });

  it('should pass through block array content unchanged', () => {
    const blocks = [{ type: 'text', text: '带图' }, { type: 'image', source: { type: 'base64' } }];
    const entry = buildUserEntry({ sessionId: 's-1', parentUuid: null, content: blocks, projectName: 'proj' });
    assert.equal(entry.message.content, blocks);
  });
});

describe('buildAssistantEntry', () => {
  it('should build assistant entry with model, blocks and top-level usage', () => {
    const entry = buildAssistantEntry({
      sessionId: 's-1',
      parentUuid: 'user-uuid',
      contentBlocks: [{ type: 'text', text: '回答' }],
      model: 'kimi-k2.5',
      usage: { input_tokens: 10, output_tokens: 5 },
      projectName: 'proj',
    });
    assert.equal(entry.type, 'assistant');
    assert.equal(entry.parentUuid, 'user-uuid');
    assert.equal(entry.message.role, 'assistant');
    assert.equal(entry.message.model, 'kimi-k2.5');
    assert.deepEqual(entry.message.content, [{ type: 'text', text: '回答' }]);
    // usage 必须在顶层（TokenUsageCalculator.calculateEntryTokens 读 entry.usage）
    assert.deepEqual(entry.usage, {
      input_tokens: 10, output_tokens: 5,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    });
  });
});

describe('normalizeUsage', () => {
  it('should fill missing fields with 0', () => {
    assert.deepEqual(normalizeUsage({ input_tokens: 7 }), {
      input_tokens: 7, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    });
  });

  it('should handle empty input', () => {
    assert.deepEqual(normalizeUsage(), {
      input_tokens: 0, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    });
  });

  it('should drop extra fields like service_tier', () => {
    const result = normalizeUsage({ input_tokens: 1, output_tokens: 2, service_tier: 'standard' });
    assert.equal(Object.keys(result).length, 4);
  });
});

describe('getLastEntryUuid', () => {
  it('should return null for empty array', () => {
    assert.equal(getLastEntryUuid([]), null);
  });

  it('should return last entry uuid', () => {
    const entries = [{ uuid: 'a' }, { uuid: 'b' }, { type: 'summary' }];
    assert.equal(getLastEntryUuid(entries), 'b');
  });
});

describe('DIRECT_ENTRY_VERSION', () => {
  it('should be a semver-like string aligned with real CLI entries', () => {
    assert.match(DIRECT_ENTRY_VERSION, /^\d+\.\d+\.\d+$/);
  });
});
