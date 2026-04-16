/**
 * API Client Tests
 *
 * Tests for the authenticatedFetch HTTP client:
 * - Default Content-Type header for JSON requests
 * - FormData requests skip Content-Type header
 * - Cookie-based credentials (credentials: 'include')
 * - Custom header merging
 * - Error response handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authenticatedFetch } from '../apiClient';

describe('authenticatedFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Need afterEach for this file since we didn't import it
  // but we can use afterAll equivalent

  it('should set Content-Type to application/json by default', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await authenticatedFetch('/api/test', { method: 'POST' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should set credentials to include (send cookies)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await authenticatedFetch('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should not set Content-Type when body is FormData', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    await authenticatedFetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const call = vi.mocked(global.fetch).mock.calls[0];
    const options = call[1] as Record<string, any>;

    // Should NOT have Content-Type when sending FormData
    expect(options.headers).not.toHaveProperty('Content-Type');
  });

  it('should merge custom headers with defaults', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await authenticatedFetch('/api/test', {
      method: 'POST',
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    });

    const call = vi.mocked(global.fetch).mock.calls[0];
    const options = call[1] as Record<string, any>;

    expect(options.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      })
    );
  });

  it('should allow custom headers to override defaults', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await authenticatedFetch('/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    const call = vi.mocked(global.fetch).mock.calls[0];
    const options = call[1] as Record<string, any>;

    // Custom header should override default
    expect(options.headers['Content-Type']).toBe('text/plain');
  });

  it('should pass through method and body', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    const body = JSON.stringify({ message: 'hello' });
    await authenticatedFetch('/api/test', {
      method: 'POST',
      body,
    });

    const call = vi.mocked(global.fetch).mock.calls[0];
    const options = call[1] as Record<string, any>;

    expect(options.method).toBe('POST');
    expect(options.body).toBe(body);
  });

  it('should default to GET when no method specified', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    await authenticatedFetch('/api/test');

    const call = vi.mocked(global.fetch).mock.calls[0];
    const options = call[1] as Record<string, any>;

    // No method = browser default = GET
    expect(options.method).toBeUndefined();
  });

  it('should return the Response object for caller to handle', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);

    const response = await authenticatedFetch('/api/test');

    expect(response).toBe(mockResponse);
    expect(response.status).toBe(200);
  });

  it('should return error Response without throwing', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
    });
    vi.mocked(global.fetch).mockResolvedValue(errorResponse);

    const response = await authenticatedFetch('/api/missing');

    // authenticatedFetch does NOT throw on HTTP errors
    // It returns the response and lets the caller handle it
    expect(response.status).toBe(404);
  });

  it('should propagate network errors as exceptions', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(authenticatedFetch('/api/test')).rejects.toThrow('Failed to fetch');
  });
});
