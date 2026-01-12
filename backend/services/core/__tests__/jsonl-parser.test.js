/**
 * jsonl-parser.test.js
 *
 * JSONL 解析器单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JsonlParser, SessionGrouping, TokenUsageCalculator } from '../utils/jsonl-parser.js';

describe('JsonlParser', () => {
  describe('parseLine', () => {
    it('should parse a valid JSON line', () => {
      const line = '{"uuid":"test","sessionId":"session1","role":"user"}';
      const result = JsonlParser.parseLine(line);
      assert.equal(result.uuid, 'test');
      assert.equal(result.sessionId, 'session1');
      assert.equal(result.role, 'user');
    });

    it('should return null for empty line', () => {
      const result = JsonlParser.parseLine('');
      assert.equal(result, null);
    });

    it('should return null for invalid JSON', () => {
      const result = JsonlParser.parseLine('invalid json');
      assert.equal(result, null);
    });
  });

  describe('parse', () => {
    it('should parse JSONL content with multiple entries', () => {
      const content = `{"uuid":"1","sessionId":"s1","role":"user","message":"Hello"}
{"uuid":"2","sessionId":"s1","role":"assistant","message":"Hi there"}`;

      const result = JsonlParser.parse(content);
      assert.equal(result.entries.length, 2);
      assert.equal(result.sessions.length, 1);
    });

    it('should handle system messages correctly', () => {
      const content = `{"uuid":"1","sessionId":"s1","role":"user","message":"<system-reminder>System message"}
{"uuid":"2","sessionId":"s1","role":"user","message":"Real user message"}`;

      const result = JsonlParser.parse(content, { includeSystemMessages: false });
      assert.equal(result.entries.length, 2);
      assert.equal(result.sessions[0].lastUserMessage, 'Real user message');
    });

    it('should filter API error messages', () => {
      const content = `{"uuid":"1","sessionId":"s1","role":"assistant","message":"CRITICAL: You MUST respond","isApiErrorMessage":true}
{"uuid":"2","sessionId":"s1","role":"assistant","message":"Normal response"}`;

      const result = JsonlParser.parse(content, { includeApiErrors: false });
      assert.equal(result.entries.length, 2);
      assert.equal(result.sessions[0].lastAssistantMessage, 'Normal response');
    });

    it('should extract text from array format content', () => {
      const content = `{"uuid":"1","sessionId":"s1","role":"user","message":[{"type":"text","text":"Array message"}]}`;

      const result = JsonlParser.parse(content);
      assert.equal(result.sessions[0].lastUserMessage, 'Array message');
    });
  });

  describe('serialize', () => {
    it('should serialize an object to JSONL line', () => {
      const obj = { uuid: 'test', role: 'user' };
      const result = JsonlParser.serialize(obj);
      assert.equal(result, '{"uuid":"test","role":"user"}');
    });
  });

  describe('serializeAll', () => {
    it('should serialize multiple objects to JSONL content', () => {
      const objects = [
        { uuid: '1', role: 'user' },
        { uuid: '2', role: 'assistant' },
      ];
      const result = JsonlParser.serializeAll(objects);
      assert.equal(result, '{"uuid":"1","role":"user"}\n{"uuid":"2","role":"assistant"}\n');
    });
  });
});

describe('SessionGrouping', () => {
  it('should group sessions by first user message', () => {
    const entries = [
      { sessionId: 's1', type: 'user', uuid: 'u1', parentUuid: null },
      { sessionId: 's2', type: 'user', uuid: 'u2', parentUuid: null },
      { sessionId: 's1', type: 'assistant', uuid: 'a1', parentUuid: 'u1' },
    ];

    const grouped = SessionGrouping.groupSessions(entries);
    assert.equal(grouped.size, 2);
    assert.equal(grouped.get('s1'), 'u1');
    assert.equal(grouped.get('s2'), 'u2');
  });
});

describe('TokenUsageCalculator', () => {
  it('should calculate tokens for entry without usage', () => {
    const entry = { uuid: 'test' };
    const result = TokenUsageCalculator.calculateEntryTokens(entry);
    assert.equal(result.total, 0);
    assert.equal(result.input, 0);
  });

  it('should calculate tokens for entry with usage', () => {
    const entry = {
      uuid: 'test',
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 10,
        output_tokens: 50,
      },
    };
    const result = TokenUsageCalculator.calculateEntryTokens(entry);
    assert.equal(result.input, 100);
    assert.equal(result.cacheCreation, 20);
    assert.equal(result.cacheRead, 10);
    assert.equal(result.output, 50);
    assert.equal(result.total, 180);
  });
});
