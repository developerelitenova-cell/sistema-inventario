import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { pingAuth } from './api';

describe('API fetch wrapper', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' })
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should inject Authorization header if token exists', async () => {
    localStorage.setItem('auth_token', 'fake-jwt-token');
    
    await pingAuth();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ping-auth'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-jwt-token'
        })
      })
    );
  });

  it('should not inject Authorization header if token does not exist', async () => {
    await pingAuth();

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const headers = fetchCall[1]?.headers as any;
    
    expect(headers.Authorization).toBeUndefined();
  });
});
