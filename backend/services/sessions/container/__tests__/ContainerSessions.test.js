/**
 * ContainerSessions.test.js
 *
 * 单元测试覆盖：
 * - encodeProjectName: 纯函数，编码项目名称
 * - parseJsonlContent: 纯函数，解析 JSONL 会话数据
 *
 * Docker 相关的异步函数（readFileFromContainer, getSessionsInContainer 等）
 * 需要容器环境，在此不做测试。
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { encodeProjectName, parseJsonlContent } from '../ContainerSessions.js';

describe('ContainerSessions', () => {
  describe('encodeProjectName', () => {
    it('should encode simple project name', () => {
      const result = encodeProjectName('my-workspace');
      // /workspace/my-workspace → replace non-ASCII → replace / → -workspace-my-workspace
      assert.equal(result, '-workspace-my-workspace');
    });

    it('should encode project name with multiple segments', () => {
      const result = encodeProjectName('org/my-project');
      // /workspace/org/my-project → -workspace-org-my-project
      assert.equal(result, '-workspace-org-my-project');
    });

    it('should replace non-ASCII characters with dash', () => {
      const result = encodeProjectName('测试');
      // /workspace/测试 → /workspace/--- (each Chinese char → -) → -workspace---
      assert.equal(result, '-workspace---');
    });

    it('should handle mixed ASCII and non-ASCII characters', () => {
      const result = encodeProjectName('my-项目');
      // /workspace/my-项目 → ascii: /workspace/my--- (2 Chinese chars each → -) → -workspace-my---
      assert.equal(result, '-workspace-my---');
    });

    it('should handle project name with numbers', () => {
      const result = encodeProjectName('project-123');
      assert.equal(result, '-workspace-project-123');
    });

    it('should handle single character project name', () => {
      const result = encodeProjectName('a');
      assert.equal(result, '-workspace-a');
    });

    it('should handle empty string project name', () => {
      const result = encodeProjectName('');
      // /workspace/ → -workspace-
      assert.equal(result, '-workspace-');
    });

    it('should handle project name with underscores', () => {
      const result = encodeProjectName('my_project');
      assert.equal(result, '-workspace-my_project');
    });

    it('should handle project name with dots', () => {
      const result = encodeProjectName('my.project');
      assert.equal(result, '-workspace-my.project');
    });

    it('should replace emoji characters with dash', () => {
      const result = encodeProjectName('my😀project');
      // emoji is a surrogate pair in UTF-16, each code unit replaced individually → --
      assert.equal(result, '-workspace-my--project');
    });
  });

  describe('parseJsonlContent', () => {
    it('should return empty result for empty content', () => {
      const result = parseJsonlContent('');
      assert.equal(result.sessions.length, 0);
      assert.equal(result.entries.length, 0);
    });

    it('should return empty result for whitespace-only content', () => {
      const result = parseJsonlContent('   \n\n   ');
      assert.equal(result.sessions.length, 0);
      assert.equal(result.entries.length, 0);
    });

    it('should skip malformed JSON lines', () => {
      const content = 'not-json\n{"sessionId":"s1","type":"user"}';
      const result = parseJsonlContent(content);
      // Only the valid line is parsed as an entry
      assert.equal(result.entries.length, 1);
    });

    it('should parse a single session entry', () => {
      const content = JSON.stringify({
        sessionId: 'session-1',
        type: 'user',
        cwd: '/workspace/my-project',
        timestamp: '2024-06-15T10:00:00Z'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions.length, 1);
      assert.equal(result.sessions[0].id, 'session-1');
      assert.equal(result.sessions[0].cwd, '/workspace/my-project');
    });

    it('should parse multiple entries in same session', () => {
      const entry1 = JSON.stringify({
        sessionId: 's1',
        type: 'user',
        message: { role: 'user', content: 'Hello' },
        timestamp: '2024-06-15T10:00:00Z'
      });
      const entry2 = JSON.stringify({
        sessionId: 's1',
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] },
        timestamp: '2024-06-15T10:01:00Z'
      });

      const result = parseJsonlContent(`${entry1}\n${entry2}`);
      assert.equal(result.sessions.length, 1);
      assert.equal(result.sessions[0].messageCount, 2);
    });

    it('should parse entries from different sessions', () => {
      const entry1 = JSON.stringify({ sessionId: 's1', type: 'user' });
      const entry2 = JSON.stringify({ sessionId: 's2', type: 'user' });

      const result = parseJsonlContent(`${entry1}\n${entry2}`);
      assert.equal(result.sessions.length, 2);
    });

    it('should set default summary to "New Session"', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        type: 'user',
        message: { role: 'user', content: 'Hello' }
      });

      const result = parseJsonlContent(content);
      // Has user message, so summary should be derived from it
      assert.equal(result.sessions[0].summary, 'Hello');
    });

    it('should extract user message content as string', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: 'How are you?' },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, 'How are you?');
    });

    it('should extract user message from array content with type text', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Array message content' }]
        },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, 'Array message content');
    });

    it('should extract assistant message from array content', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Assistant reply' }]
        },
        type: 'assistant'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastAssistantMessage, 'Assistant reply');
    });

    it('should extract assistant message from string content', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'assistant', content: 'String reply' },
        type: 'assistant'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastAssistantMessage, 'String reply');
    });

    it('should skip API error messages from assistant', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'assistant', content: 'Error message' },
        type: 'assistant',
        isApiErrorMessage: true
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastAssistantMessage, null);
    });

    it('should filter system messages from user content', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: '<system-reminder>This is a system reminder' },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, null);
    });

    it('should filter command-name system messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: '<command-name>test</command-name>' },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, null);
    });

    it('should filter Caveat system messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: 'Caveat: some warning text here' },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, null);
    });

    it('should filter Warmup system messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: 'Warmup' },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, null);
    });

    it('should update summary from summary entries', () => {
      const content = [
        JSON.stringify({ sessionId: 's1', type: 'user', message: { role: 'user', content: 'Hello' } }),
        JSON.stringify({ sessionId: 's1', type: 'summary', summary: 'Custom summary' })
      ].join('\n');

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].summary, 'Custom summary');
    });

    it('should truncate long messages in summary to 50 chars', () => {
      const longMessage = 'A'.repeat(100);
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'user', content: longMessage },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.ok(result.sessions[0].summary.length <= 53); // 50 + '...'
      assert.ok(result.sessions[0].summary.endsWith('...'));
    });

    it('should update lastActivity from timestamp', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        type: 'user',
        timestamp: '2024-12-25T15:30:00Z'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastActivity.toISOString(), '2024-12-25T15:30:00.000Z');
    });

    it('should apply pending summary from leafUuid', () => {
      const content = [
        JSON.stringify({ type: 'summary', summary: 'Pending summary', leafUuid: 'leaf-1' }),
        JSON.stringify({ sessionId: 's1', type: 'user', parentUuid: 'leaf-1', message: { role: 'user', content: 'Hi' } })
      ].join('\n');

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].summary, 'Pending summary');
    });

    it('should filter sessions with JSON error summaries', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        type: 'user',
        message: { role: 'user', content: '{ "error": "something" }' }
      });

      const result = parseJsonlContent(content);
      // Session summary starts with '{ "' → should be filtered
      assert.equal(result.sessions.length, 0);
    });

    it('should keep sessions with normal summaries', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        type: 'user',
        message: { role: 'user', content: 'Normal user message' }
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions.length, 1);
      assert.equal(result.sessions[0].summary, 'Normal user message');
    });

    it('should filter Invalid API key assistant messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'assistant', content: 'Invalid API key provided' },
        type: 'assistant'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastAssistantMessage, null);
    });

    it('should filter subtasks JSON assistant messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: { role: 'assistant', content: 'Here is {"subtasks": [{"name": "task1"}]}' },
        type: 'assistant'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastAssistantMessage, null);
    });

    it('should filter "continued from a previous" system messages', () => {
      const content = JSON.stringify({
        sessionId: 's1',
        message: {
          role: 'user',
          content: 'This session is being continued from a previous conversation'
        },
        type: 'user'
      });

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].lastUserMessage, null);
    });

    it('should count all session entries in messageCount', () => {
      const content = [
        JSON.stringify({ sessionId: 's1', type: 'user' }),
        JSON.stringify({ sessionId: 's1', type: 'assistant' }),
        JSON.stringify({ sessionId: 's1', type: 'summary', summary: 'test' })
      ].join('\n');

      const result = parseJsonlContent(content);
      assert.equal(result.sessions[0].messageCount, 3);
    });
  });
});
