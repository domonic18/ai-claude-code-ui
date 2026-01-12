/**
 * message-filter.test.js
 *
 * 消息过滤器单元测试
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MessageFilter, MessageTransformer, MessageAggregator } from '../utils/message-filter.js';

describe('MessageFilter', () => {
  const sampleMessages = [
    {
      uuid: '1',
      sessionId: 's1',
      role: 'user',
      message: 'Hello',
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      uuid: '2',
      sessionId: 's1',
      role: 'assistant',
      message: 'Hi there',
      timestamp: '2024-01-01T10:01:00Z',
    },
    {
      uuid: '3',
      sessionId: 's1',
      role: 'user',
      message: '<system-reminder>System message',
      timestamp: '2024-01-01T10:02:00Z',
    },
    {
      uuid: '4',
      sessionId: 's1',
      role: 'assistant',
      message: 'CRITICAL: You MUST respond',
      isApiErrorMessage: true,
      timestamp: '2024-01-01T10:03:00Z',
    },
  ];

  describe('isSystemMessage', () => {
    it('should identify system messages', () => {
      const result = MessageFilter.isSystemMessage(sampleMessages[2]);
      assert.equal(result, true);
    });

    it('should return false for normal messages', () => {
      const result = MessageFilter.isSystemMessage(sampleMessages[0]);
      assert.equal(result, false);
    });
  });

  describe('isApiErrorMessage', () => {
    it('should identify API error messages by flag', () => {
      const result = MessageFilter.isApiErrorMessage(sampleMessages[3]);
      assert.equal(result, true);
    });

    it('should identify API error messages by content', () => {
      const message = {
        message: '{"subtasks":',
      };
      const result = MessageFilter.isApiErrorMessage(message);
      assert.equal(result, true);
    });
  });

  describe('extractText', () => {
    it('should extract text from string message', () => {
      const result = MessageFilter.extractText(sampleMessages[0]);
      assert.equal(result, 'Hello');
    });

    it('should extract text from array format message', () => {
      const message = {
        message: [{ type: 'text', text: 'Array text' }],
      };
      const result = MessageFilter.extractText(message);
      assert.equal(result, 'Array text');
    });
  });

  describe('filterSystemMessages', () => {
    it('should filter out system messages', () => {
      const result = MessageFilter.filterSystemMessages(sampleMessages);
      assert.equal(result.length, 3);
      assert.equal(result.filter(m => m.role === 'user').length, 1);
    });
  });

  describe('filterApiErrorMessages', () => {
    it('should filter out API error messages', () => {
      const result = MessageFilter.filterApiErrorMessages(sampleMessages);
      assert.equal(result.length, 3);
    });
  });

  describe('filterByRole', () => {
    it('should filter messages by role', () => {
      const result = MessageFilter.filterByRole(sampleMessages, 'user');
      assert.equal(result.length, 2);
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const result = MessageFilter.truncateText('This is a very long text', 10);
      assert.equal(result, 'This is a ...');
    });

    it('should not truncate short text', () => {
      const result = MessageFilter.truncateText('Short', 10);
      assert.equal(result, 'Short');
    });
  });
});

describe('MessageTransformer', () => {
  describe('simplify', () => {
    it('should simplify message object', () => {
      const message = {
        uuid: '1',
        sessionId: 's1',
        role: 'user',
        message: 'Hello',
        timestamp: '2024-01-01T10:00:00Z',
        cwd: '/workspace',
      };
      const result = MessageTransformer.simplify(message);
      assert.equal(result.uuid, '1');
      assert.equal(result.role, 'user');
      assert.equal(result.text, 'Hello');
      assert.equal(result.timestamp, '2024-01-01T10:00:00Z');
    });
  });

  describe('sortByTimestamp', () => {
    it('should sort messages by timestamp ascending', () => {
      const messages = [
        { timestamp: '2024-01-01T10:02:00Z' },
        { timestamp: '2024-01-01T10:00:00Z' },
        { timestamp: '2024-01-01T10:01:00Z' },
      ];
      const result = MessageTransformer.sortByTimestamp(messages, 'asc');
      assert.equal(result[0].timestamp, '2024-01-01T10:00:00Z');
      assert.equal(result[2].timestamp, '2024-01-01T10:02:00Z');
    });
  });

  describe('paginate', () => {
    it('should paginate message list', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        uuid: `${i}`,
      }));
      const result = MessageTransformer.paginate(messages, 10, 0);
      assert.equal(result.messages.length, 10);
      assert.equal(result.total, 100);
      assert.equal(result.hasMore, true);
    });
  });
});

describe('MessageAggregator', () => {
  describe('aggregateStats', () => {
    it('should calculate message statistics', () => {
      const messages = [
        { role: 'user', type: 'user', timestamp: '2024-01-01T10:00:00Z' },
        { role: 'assistant', type: 'assistant', timestamp: '2024-01-01T10:01:00Z', usage: { input_tokens: 100, output_tokens: 50 } },
        { role: 'user', type: 'user', timestamp: '2024-01-01T10:02:00Z' },
      ];
      const result = MessageAggregator.aggregateStats(messages);
      assert.equal(result.totalCount, 3);
      assert.equal(result.byRole.user, 2);
      assert.equal(result.byRole.assistant, 1);
      assert.equal(result.tokenUsage.input, 100);
      assert.equal(result.tokenUsage.output, 50);
    });
  });
});
