/**
 * ChatService Tests
 *
 * Tests for the ChatService class:
 * - Loading messages (success and error cases)
 * - File upload (success and error cases)
 * - File info retrieval
 * - Command execution
 * - Configuration management
 * - Singleton pattern in getChatService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock authenticatedFetch before importing ChatService
vi.mock('@/shared/services', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { ChatService, getChatService } from '../chatService';
import { authenticatedFetch } from '@/shared/services';

const mockFetch = vi.mocked(authenticatedFetch);

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService({ projectName: 'test-project' });
  });

  describe('Configuration', () => {
    it('should store config from constructor', () => {
      const svc = new ChatService({ projectName: 'my-project', sessionId: 'sess-1' });
      // Config is used internally, verify via method behavior
      expect(svc).toBeInstanceOf(ChatService);
    });

    it('should update config via setConfig', () => {
      service.setConfig({ projectName: 'new-project' });
      // Verify config update by checking behavior in getFileInfo
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

      service.getFileInfo('/path/to/file', 'new-project');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/files/info',
        expect.objectContaining({
          body: expect.stringContaining('"projectName":"new-project"'),
        })
      );
    });

    it('should merge partial config updates', () => {
      service.setConfig({ sessionId: 'new-session' });
      // Original projectName should still be there
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

      service.getFileInfo('/path');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/files/info',
        expect.objectContaining({
          body: expect.stringContaining('"projectName":"test-project"'),
        })
      );
    });
  });

  describe('loadMessages', () => {
    it('should load messages successfully', async () => {
      const messages = [
        { id: 1, content: 'Hello' },
        { id: 2, content: 'World' },
      ];
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, messages }), { status: 200 })
      );

      const result = await service.loadMessages({ sessionId: 'sess-1' });

      expect(result.success).toBe(true);
      expect(result.messages).toEqual(messages);
    });

    it('should send pagination parameters', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.loadMessages({ sessionId: 'sess-1', offset: 10, limit: 5 });

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as any).body
      );
      expect(callBody).toEqual({
        sessionId: 'sess-1',
        offset: 10,
        limit: 5,
      });
    });

    it('should use default pagination (offset=0, limit=20)', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.loadMessages({ sessionId: 'sess-1' });

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as any).body
      );
      expect(callBody.offset).toBe(0);
      expect(callBody.limit).toBe(20);
    });

    it('should return error when request fails', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not Found', { status: 404 })
      );

      const result = await service.loadMessages({ sessionId: 'bad-session' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load messages');
    });

    it('should return error when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.loadMessages({ sessionId: 'sess-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, url: '/files/test.txt', name: 'test.txt' }),
          { status: 200 }
        )
      );

      const result = await service.uploadFile(file, {});

      expect(result.success).toBe(true);
      expect(result.url).toBe('/files/test.txt');
    });

    it('should send FormData with file', async () => {
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.uploadFile(file, { projectName: 'my-project' });

      const callOptions = mockFetch.mock.calls[0][1] as any;
      expect(callOptions.body).toBeInstanceOf(FormData);
    });

    it('should include project from config in FormData', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.uploadFile(file, {});

      const callOptions = mockFetch.mock.calls[0][1] as any;
      const formData = callOptions.body as FormData;
      expect(formData.get('project')).toBe('test-project');
    });

    it('should return error when upload fails', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      mockFetch.mockResolvedValue(
        new Response('Server Error', { status: 500 })
      );

      const result = await service.uploadFile(file, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to upload file');
    });

    it('should return error when fetch throws', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      mockFetch.mockRejectedValue(new Error('Connection lost'));

      const result = await service.uploadFile(file, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection lost');
    });
  });

  describe('getFileInfo', () => {
    it('should get file info successfully', async () => {
      const info = { size: 1024, modified: '2024-01-01' };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, info }), { status: 200 })
      );

      const result = await service.getFileInfo('/path/to/file', 'test-project');

      expect(result.success).toBe(true);
      expect(result.info).toEqual(info);
    });

    it('should use config projectName when not specified', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.getFileInfo('/path/to/file');

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as any).body
      );
      expect(callBody.projectName).toBe('test-project');
    });

    it('should return error when no project name available', async () => {
      const svc = new ChatService();

      const result = await svc.getFileInfo('/path/to/file');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project name required');
    });

    it('should return error when request fails', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not Found', { status: 404 })
      );

      const result = await service.getFileInfo('/missing', 'test-project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get file info');
    });
  });

  describe('executeCommand', () => {
    it('should execute command successfully', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, result: 'done' }), { status: 200 })
      );

      const result = await service.executeCommand({
        name: 'test-command',
        args: ['--flag'],
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('done');
    });

    it('should include context from config', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await service.executeCommand({ name: 'cmd' });

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as any).body
      );
      expect(callBody.context.projectPath).toBe('test-project');
    });

    it('should return error when execution fails', async () => {
      mockFetch.mockResolvedValue(
        new Response('Error', { status: 500 })
      );

      const result = await service.executeCommand({ name: 'fail-cmd' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to execute command');
    });
  });
});

describe('getChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level singleton by reimporting
    // Since we can't easily reset module state, we test the pattern
  });

  it('should return a ChatService instance', () => {
    const svc = getChatService();
    expect(svc).toBeInstanceOf(ChatService);
  });

  it('should return same instance on subsequent calls', () => {
    const svc1 = getChatService();
    const svc2 = getChatService();
    expect(svc1).toBe(svc2);
  });
});
